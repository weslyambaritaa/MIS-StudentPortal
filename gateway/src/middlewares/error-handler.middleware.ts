import type { NextFunction, Request, Response } from "express";
import { apiErrorBody, getRequestId, createLogger } from "@mis/logger";
const logger = createLogger("api-gateway");

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = getRequestId(req, res);
  const path = (req.originalUrl || req.path).split("?")[0];
  logger.error({ err: error, requestId, method: req.method, path, statusCode: 500, userId: req.auth?.payload?.sub }, "Unhandled gateway error");
  return res.status(500).json(apiErrorBody("INTERNAL_SERVER_ERROR", "Something went wrong. Please try again. If the problem continues, contact support.", requestId));
}
