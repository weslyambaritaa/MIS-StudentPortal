import type { NextFunction, Request, Response } from "express";
import { apiErrorBody, getRequestId } from "@mis/logger";
import { AppError } from "../errors/app-error";
import { logger } from "../modules/monitoring/logger";
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const status = error instanceof AppError ? error.statusCode : 500;
  const requestId = getRequestId(req, res);
  const path = (req.originalUrl || req.path).split("?")[0];
  const upstreamStatusCode = error && typeof error === "object" && "upstreamStatusCode" in error
    ? (error as { upstreamStatusCode?: number }).upstreamStatusCode
    : undefined;
  logger[status >= 500 ? "error" : "warn"]({ err: error, ...(upstreamStatusCode ? { upstreamStatusCode } : {}), requestId, method: req.method, path, statusCode: status, userId: req.auth?.userId ?? req.adminAuth?.userId }, "API request failed");
  const message = error instanceof AppError ? error.message : "Something went wrong. Please try again. If the problem continues, contact support.";
  const code = error instanceof AppError ? (status < 500 ? "REQUEST_REJECTED" : "SERVICE_ERROR") : "INTERNAL_SERVER_ERROR";
  return res.status(status).json(apiErrorBody(code, message, requestId));
}
