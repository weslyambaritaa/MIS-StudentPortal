import type { Request, Response } from "express";
import { apiErrorBody, getRequestId } from "@mis/logger";
export function notFound(req: Request, res: Response) {
  return res.status(404).json(apiErrorBody("NOT_FOUND", "The requested resource was not found.", getRequestId(req, res)));
}
