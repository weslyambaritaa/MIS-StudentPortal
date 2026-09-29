import type { NextFunction, Request, Response } from "express";

import { InternalApiResponseError, InternalApiUnavailableError } from "../integrations/internal-api/internal-api.client";

export function internalApiError(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (error instanceof InternalApiUnavailableError) {
    return res.status(503).json({ message: error.message });
  }
  if (error instanceof InternalApiResponseError) {
    return res.status(error.status).json({ message: "Internal service request failed" });
  }
  return next(error);
}
