import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { apiErrorBody, getRequestId } from "@mis/logger";
import { env } from "../../config/env";
import { sendFailureAlert } from "./failure-alert.service";
import { logger } from "./logger";

export const monitoringAlertRouter = Router();

monitoringAlertRouter.post("/", async (req, res) => {
  const provided = req.header("x-gateway-secret") ?? "";
  const expected = env.gatewaySharedSecret;
  if (provided.length !== expected.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return res.status(401).json(apiErrorBody("UNAUTHORIZED", "Monitoring report is not authorized.", getRequestId(req, res)));
  }

  const input = req.body as Record<string, unknown> | undefined;
  if (!input || typeof input.service !== "string" || typeof input.requestId !== "string" || typeof input.method !== "string" || typeof input.path !== "string" || !Number.isInteger(input.statusCode) || !Number.isInteger(input.occurrences) || !Number.isInteger(input.windowMinutes)) {
    return res.status(400).json(apiErrorBody("INVALID_MONITORING_REPORT", "Monitoring report is invalid.", getRequestId(req, res)));
  }
  const alert = {
    service: input.service.slice(0, 80),
    requestId: input.requestId.slice(0, 100),
    method: input.method.slice(0, 12),
    path: input.path.split("?")[0].slice(0, 300),
    statusCode: Number(input.statusCode),
    occurrences: Number(input.occurrences),
    windowMinutes: Number(input.windowMinutes),
    summary: typeof input.summary === "string" ? input.summary.slice(0, 400) : undefined,
  };

  try {
    logger.error(alert, "Repeated HTTP 5xx failures reported by a service");
    const sent = await sendFailureAlert(alert);
    if (!sent) return res.status(503).json(apiErrorBody("ALERT_CHANNEL_NOT_CONFIGURED", "The email alert channel is not configured.", getRequestId(req, res)));
    return res.status(202).json({ status: "accepted", requestId: getRequestId(req, res) });
  } catch (error) {
    logger.error({ err: error, requestId: alert.requestId, service: alert.service }, "Could not send critical error alert");
    return res.status(503).json(apiErrorBody("ALERT_DELIVERY_FAILED", "The monitoring alert could not be delivered.", getRequestId(req, res)));
  }
});
