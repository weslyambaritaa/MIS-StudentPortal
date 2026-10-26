import type { NextFunction, Request, Response } from "express";
import { apiErrorBody, getRequestId, createLogger } from "@mis/logger";
import { AppError } from "../errors/app-error";
const logger = createLogger("student-api");
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const status = error instanceof AppError ? error.statusCode : 500;
  const requestId = getRequestId(req, res);
  const path = (req.originalUrl || req.path).split("?")[0];
  logger[status >= 500 ? "error" : "warn"]({ err: error, requestId, method: req.method, path, statusCode: status, userId: req.auth?.userId }, "API request failed");
  const message = error instanceof AppError ? error.message : "Something went wrong. Please try again. If the problem continues, contact Developer Support and provide the request ID.";
  const code = error instanceof AppError ? (status < 500 ? "REQUEST_REJECTED" : "SERVICE_ERROR") : "INTERNAL_SERVER_ERROR";
  return res.status(status).json(apiErrorBody(code, message, requestId));
}
