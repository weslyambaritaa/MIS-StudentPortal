import type { NextFunction, Request, Response } from "express";
import { apiErrorBody, getRequestId } from "@mis/logger";

import { InternalApiResponseError, InternalApiUnavailableError } from "../integrations/internal-api/internal-api.client";

export function internalApiError(error: unknown, req: Request, res: Response, next: NextFunction) {
  if (error instanceof InternalApiUnavailableError) {
    return res.status(503).json(apiErrorBody("DEPENDENCY_UNAVAILABLE", error.message, getRequestId(req, res)));
  }
  if (error instanceof InternalApiResponseError) {
    return res.status(error.status).json(apiErrorBody("DEPENDENCY_REQUEST_FAILED", "A required service could not complete the request.", getRequestId(req, res)));
  }
  return next(error);
}
