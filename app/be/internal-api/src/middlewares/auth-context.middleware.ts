import type { NextFunction, Request, Response } from "express";
import { isBusinessRole, isInternalRole, type Role } from "@mis/shared-types";
import { env } from "../config/env";

export function authContext(req: Request, res: Response, next: NextFunction) {
  if (req.header("x-gateway-secret") !== env.gatewaySharedSecret) {
    return res.status(401).json({ message: "Request must come through API Gateway" });
  }

  const userId = req.header("x-auth-user-id");
  if (!userId) {
    return res.status(401).json({ message: "Missing authenticated user context" });
  }

  const forwardedRoles = (req.header("x-auth-user-roles") ?? "").split(",").filter(Boolean);
  if (forwardedRoles.length === 0 || !forwardedRoles.every(isBusinessRole)) {
    return res.status(403).json({ message: "Invalid authenticated role context" });
  }

  const roles = forwardedRoles as Role[];
  const activeRole = req.header("x-auth-active-role");
  if (!isInternalRole(activeRole) || !roles.includes(activeRole)) {
    return res.status(403).json({ message: "Active role is not allowed for the internal API" });
  }

  req.auth = {
    userId,
    email: req.header("x-auth-user-email") || undefined,
    roles,
    activeRole,
  };

  next();
}
