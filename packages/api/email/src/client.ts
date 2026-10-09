import { getBool, getEnv, getNum } from "@oc/env/server";
import { createTransport } from "nodemailer";
import { getEmailConfig } from "./config";

function _debugLog(msg: string) {
  if (process.env.NODE_ENV === "production") return;
  console.log(`[EMAIL] ${new Date().toISOString()} ${msg}`);
}

function maskRecipients(recipients: string | string[]): string {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return list
    .map((email) => {
      const parts = email.split("@");
      if (parts.length !== 2) return email;
      return `${parts[0]!.slice(0, 2)}***@${parts[1]!}`;
    })
    .join(", ");
}

function createResendClient(apiKey: string) {
  const { Resend } = require("resend");
  return new Resend(apiKey);
}

function createSMTPTransport() {
  return createTransport({
    host: getEnv("SMTP_HOST") || "localhost",
    port: getNum("SMTP_PORT", 1025),
    secure: false,
    auth: getEnv("SMTP_USER")
      ? {
          user: getEnv("SMTP_USER"),
          pass: getEnv("SMTP_PASS"),
        }
      : undefined,
  });
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: { name: string; email: string };
}

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryResend(
  fromAddress: string,
  to: string[],
  subject: string,
  html: string,
  text: string,
  replyTo?: string,
  maxRetries = MAX_RETRIES
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resendApiKey = getEnv("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error(`[email] No Resend API key configured for ${maskRecipients(to)}`);
    return { success: false, error: "No Resend API key configured" };
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resend = createResendClient(resendApiKey);
      const data = await resend.emails.send({
        from: fromAddress,
        to,
        subject,
        html,
        text,
        replyTo,
      });

      if (data?.data?.id) return { success: true, messageId: data.data.id };

      if (data?.error) {
        const errMsg = data.error.message || "Resend API error";
        const errCode = data.error.statusCode || 0;
        if (errCode >= 400 && errCode < 500 && errCode !== 429) {
          console.error(
            `[email] Resend client error ${errCode} for ${maskRecipients(to)}: ${errMsg}`
          );
          return { success: false, error: errMsg };
        }
        lastError = new Error(errMsg);
      } else {
        lastError = new Error("Unexpected Resend response");
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message.includes("RESEND_API_KEY") || err.message.includes("not configured")) {
        console.error(`[email] Resend config error for ${maskRecipients(to)}: ${err.message}`);
        return { success: false, error: err.message };
      }
      lastError = err;
    }

    if (attempt < maxRetries) {
      await sleep(RETRY_DELAY_BASE * 2 ** (attempt - 1));
    }
  }

  console.error(`[email] Resend exhausted retries for ${maskRecipients(to)}:`, lastError);
  return { success: false, error: lastError?.message || "Failed to send email after retries" };
}

async function trySMTP(
  fromAddress: string,
  to: string[],
  subject: string,
  html: string,
  text: string,
  replyTo?: string,
  maxRetries = MAX_RETRIES
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const smtpEnabled = getBool("SMTP_ENABLED", false);
  const smtpHost = getEnv("SMTP_HOST");

  if (!smtpEnabled || !smtpHost) {
    console.error(`[email] SMTP not configured for ${maskRecipients(to)}`);
    return { success: false, error: "SMTP not configured" };
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const transporter = createSMTPTransport();
      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        text,
        replyTo,
      });
      return { success: true };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await sleep(RETRY_DELAY_BASE * 2 ** (attempt - 1));
      }
    }
  }

  console.error(`[email] SMTP exhausted retries for ${maskRecipients(to)}:`, lastError);
  return { success: false, error: lastError?.message || "SMTP send failed after retries" };
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  _debugLog(`sendEmail called: to=${maskRecipients(options.to)}, subject=${options.subject}`);

  const cfg = await getEmailConfig();
  const { to, subject, html, text, replyTo, from } = options;

  const fromAddress = from ? `${from.name} <${from.email}>` : `${cfg.fromName} <${cfg.fromEmail}>`;
  const toArray = Array.isArray(to) ? to : [to];
  const textBody = text || html.replace(/<[^>]*>/g, "");

  const resendApiKey = getEnv("RESEND_API_KEY");
  const smtpEnabled = getBool("SMTP_ENABLED", false);
  const smtpHost = getEnv("SMTP_HOST") ?? "";
  const smtpConfigured = smtpEnabled && smtpHost.length > 0;
  const resendMaxRetries = smtpConfigured ? 1 : MAX_RETRIES;

  if (smtpConfigured) {
    const smtpResult = await trySMTP(fromAddress, toArray, subject, html, textBody, replyTo);
    if (smtpResult.success) return smtpResult;
  }

  if (resendApiKey) {
    const resendResult = await tryResend(
      fromAddress,
      toArray,
      subject,
      html,
      textBody,
      replyTo,
      resendMaxRetries
    );
    if (resendResult.success) return resendResult;

    _debugLog(`Resend failed: ${resendResult.error}. Trying SMTP...`);

    if (smtpConfigured) {
      const smtpResult = await trySMTP(fromAddress, toArray, subject, html, textBody, replyTo);
      if (smtpResult.success) {
        _debugLog("SMTP fallback succeeded");
        return smtpResult;
      }
      _debugLog(`SMTP fallback also failed: ${smtpResult.error}`);
    }

    return resendResult;
  }

  if (smtpConfigured) {
    return trySMTP(fromAddress, toArray, subject, html, textBody, replyTo);
  }

  console.error(
    `[email] No provider configured for ${maskRecipients(to)}: neither Resend nor SMTP available`
  );
  return {
    success: false,
    error: "No email provider configured. Set RESEND_API_KEY or enable SMTP.",
  };
}
