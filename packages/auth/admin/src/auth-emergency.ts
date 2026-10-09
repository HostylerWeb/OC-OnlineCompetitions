import { pbkdf2Sync, randomInt, timingSafeEqual } from "node:crypto";
import { dbConnect } from "@oc/api-db";
import { EmergencyError } from "@oc/api-errors";
import { getAdminAuth } from "@oc/auth-admin/admin-auth";
import { sendEmergencyOtpEmail } from "@oc/auth-admin/auth-email";
import { type AdminSetupResult, upsertAdminAccount } from "@oc/auth-admin/auth-setup";
import { secretsEqual } from "@oc/auth-admin/secret-compare";
import { getEnv } from "@oc/env/server";

const getAppUrl = () => getEnv("APP_URL").replace(/\/$/, "");

export const ADMIN_EMERGENCY_EMAIL = "admin@onlinecompetitions.co.uk";

const EMERGENCY_SECRET_HEADER = "x-emergency-secret";
const OTP_EXPIRES_IN_SEC = 300;
const OTP_ALLOWED_ATTEMPTS = 5;
const OTP_PBKDF2_ITERATIONS = 100_000;
const OTP_PBKDF2_KEYLEN = 32;
const OTP_PBKDF2_DIGEST = "sha256";

export type AdminEmergencyStatus = {
  enabled: boolean;
  email: string;
};

function emergencyOtpIdentifier(): string {
  return `admin-emergency-otp-${ADMIN_EMERGENCY_EMAIL}`;
}

function getConfiguredEmergencySecret(): string | null {
  const secret = getEnv("ADMIN_EMERGENCY_SECRET")?.trim();
  return secret || null;
}

export function isEmergencyRecoveryEnabled(): boolean {
  return getConfiguredEmergencySecret() !== null;
}

export function validateEmergencySecret(headerValue: string | undefined): boolean {
  const secret = getConfiguredEmergencySecret();
  if (!secret) return false;
  return secretsEqual(headerValue, secret);
}

export function getEmergencySecretHeaderName(): string {
  return EMERGENCY_SECRET_HEADER;
}

function hashOtp(otp: string): string {
  const secret = getConfiguredEmergencySecret() ?? "default-secret-change-in-production";
  return pbkdf2Sync(
    otp,
    secret,
    OTP_PBKDF2_ITERATIONS,
    OTP_PBKDF2_KEYLEN,
    OTP_PBKDF2_DIGEST
  ).toString("base64url");
}

function splitAttempts(value: string): [string, string] {
  const idx = value.lastIndexOf(":");
  if (idx === -1) return [value, "0"];
  return [value.slice(0, idx), value.slice(idx + 1)];
}

function generateEmergencyOtp(length = 6): string {
  return Array.from({ length }, () => randomInt(0, 10)).join("");
}

function verifyOtpHash(storedHash: string, otp: string): boolean {
  const candidate = hashOtp(otp);
  const storedBuf = Buffer.from(storedHash);
  const candidateBuf = Buffer.from(candidate);
  if (storedBuf.length !== candidateBuf.length) return false;
  return timingSafeEqual(storedBuf, candidateBuf);
}

export async function getAdminEmergencyStatus(): Promise<AdminEmergencyStatus> {
  return {
    enabled: isEmergencyRecoveryEnabled(),
    email: ADMIN_EMERGENCY_EMAIL,
  };
}

export async function requestAdminEmergencyOtp(input: { emergencySecret?: string }): Promise<void> {
  if (!isEmergencyRecoveryEnabled()) {
    throw new EmergencyError("NOT_FOUND", "Emergency recovery is not enabled.", 404);
  }

  if (!validateEmergencySecret(input.emergencySecret)) {
    throw new EmergencyError("FORBIDDEN", "Invalid or missing emergency secret.", 403);
  }

  await dbConnect();

  const auth = await getAdminAuth();
  const ctx = await auth.$context;
  const identifier = emergencyOtpIdentifier();
  const otp = generateEmergencyOtp();
  const storedOtp = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_SEC * 1000);

  await ctx.internalAdapter.deleteVerificationByIdentifier(identifier);
  await ctx.internalAdapter.createVerificationValue({
    value: `${storedOtp}:0`,
    identifier,
    expiresAt,
  });

  const adminUrl = getAppUrl();
  const recoveryUrl = `${adminUrl}/auth/emergency`;

  await sendEmergencyOtpEmail({
    email: ADMIN_EMERGENCY_EMAIL,
    otp,
    recoveryUrl,
  });

  console.log(JSON.stringify({ event: "admin_emergency_otp_sent", email: ADMIN_EMERGENCY_EMAIL }));
}

export async function completeAdminEmergencyRecovery(input: {
  otp: string;
}): Promise<AdminSetupResult> {
  if (!isEmergencyRecoveryEnabled()) {
    throw new EmergencyError("NOT_FOUND", "Emergency recovery is not enabled.", 404);
  }

  const otp = input.otp?.trim();
  if (!otp || !/^\d{6}$/.test(otp)) {
    throw new EmergencyError("VALIDATION_ERROR", "A valid 6-digit OTP is required.", 400);
  }

  await dbConnect();

  const auth = await getAdminAuth();
  const ctx = await auth.$context;
  const identifier = emergencyOtpIdentifier();
  const verificationValue = await ctx.internalAdapter.findVerificationValue(identifier);

  if (!verificationValue) {
    throw new EmergencyError("VALIDATION_ERROR", "Invalid or expired OTP.", 400);
  }

  if (verificationValue.expiresAt < new Date()) {
    await ctx.internalAdapter.deleteVerificationByIdentifier(identifier);
    throw new EmergencyError("VALIDATION_ERROR", "OTP has expired. Request a new code.", 400);
  }

  const [storedHash, attemptsRaw] = splitAttempts(verificationValue.value);
  const attempts = Number.parseInt(attemptsRaw, 10) || 0;

  if (attempts >= OTP_ALLOWED_ATTEMPTS) {
    await ctx.internalAdapter.deleteVerificationByIdentifier(identifier);
    throw new EmergencyError("FORBIDDEN", "Too many invalid OTP attempts.", 403);
  }

  if (!verifyOtpHash(storedHash, otp)) {
    await ctx.internalAdapter.updateVerificationByIdentifier(identifier, {
      value: `${storedHash}:${attempts + 1}`,
    });
    throw new EmergencyError("VALIDATION_ERROR", "Invalid or expired OTP.", 400);
  }

  await ctx.internalAdapter.deleteVerificationByIdentifier(identifier);

  const result = await upsertAdminAccount(ADMIN_EMERGENCY_EMAIL);
  console.log(JSON.stringify({ event: "admin_emergency_repair_completed", email: result.email }));
  return result;
}
