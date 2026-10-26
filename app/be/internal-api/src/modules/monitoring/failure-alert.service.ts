import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { logger } from "./logger";

export type FailureAlert = {
  service: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  occurrences: number;
  windowMinutes: number;
  summary?: string;
};

let transport: nodemailer.Transporter | undefined;

export async function sendFailureAlert(alert: FailureAlert): Promise<boolean> {
  if (!env.developerSupportEmail) {
    logger.warn({ service: alert.service, requestId: alert.requestId }, "Critical alert not sent: DEVELOPER_SUPPORT_EMAIL is not configured");
    return false;
  }
  if (!env.mailHost || !env.mailUsername || !env.mailPassword || !env.mailFromAddress) {
    logger.error({ service: alert.service, requestId: alert.requestId }, "Critical alert not sent: SMTP configuration is incomplete");
    return false;
  }

  transport ??= nodemailer.createTransport({
    host: env.mailHost,
    port: env.mailPort,
    secure: env.mailPort === 465,
    auth: { user: env.mailUsername, pass: env.mailPassword },
    requireTLS: env.mailEncryption === "tls",
  });
  const subject = alert.summary
    ? `[MIS Critical] ${alert.service}: ${alert.path} failed`
    : `[MIS Critical] Repeated server errors in ${alert.service}`;
  await transport.sendMail({
    from: { name: env.mailFromName, address: env.mailFromAddress },
    to: env.developerSupportEmail,
    subject,
    text: [
      alert.summary ? "A critical system failure was detected." : "Repeated server-side failures were detected.",
      `Service: ${alert.service}`,
      `Request ID: ${alert.requestId}`,
      `Endpoint: ${alert.method} ${alert.path}`,
      `Last HTTP status: ${alert.statusCode}`,
      `Occurrences: ${alert.occurrences} within ${alert.windowMinutes} minute(s)`,
      alert.summary ? `Summary: ${alert.summary}` : "",
      "",
      "Use the request ID and service logs to investigate. No request body, query string, or authentication token is included.",
    ].filter(Boolean).join("\n"),
  });
  logger.info({ service: alert.service, requestId: alert.requestId }, "Critical error alert email sent");
  return true;
}
