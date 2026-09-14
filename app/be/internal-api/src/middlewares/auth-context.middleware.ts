import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
export function authContext(req: Request, res: Response, next: NextFunction) {
  if (req.header("x-gateway-secret") !== env.gatewaySharedSecret) return res.status(401).json({ message: "Request must come through API Gateway" });
  const userId = req.header("x-auth-user-id");
  if (!userId) return res.status(401).json({ message: "Missing authenticated user context" });
  req.auth = { userId, email: req.header("x-auth-user-email") ?? undefined, roles: (req.header("x-auth-user-roles") ?? "").split(",").filter(Boolean) };
  next();
}
