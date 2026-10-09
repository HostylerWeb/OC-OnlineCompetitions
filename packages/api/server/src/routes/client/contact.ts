import { sendEmail } from "@oc/api-email/client";
import { getEmailConfig } from "@oc/api-email/config";
import { ContactNotificationEmail } from "@oc/api-email/templates/contact-notification";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { contactRateLimit } from "@oc/api-server/middleware/rate-limit";
import { render } from "@react-email/render";
import { Hono } from "hono";

const app = new Hono();

app.use("*", contactRateLimit());

app.post("/", async (c) => {
  try {
    const { name, email, subject, message } = await c.req.json();

    if (!name || !email || !subject || !message) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "All fields are required", 400);
    }

    const submittedAt = new Date().toLocaleString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const settings = await getEmailConfig();
    const emailHtml = await render(
      ContactNotificationEmail({ name, email, subject, message, submittedAt, settings })
    );

    await sendEmail({
      to: settings.supportAddress,
      subject: `Contact Form: ${subject} (from ${name})`,
      html: emailHtml,
      replyTo: email,
    });

    return success(c, { message: "Message sent successfully" });
  } catch (err: unknown) {
    console.error("Contact error:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "contact.submit",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to send message", 500);
  }
});

export default app;
