import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { KEYCLOAK_ADMIN_ROLES, isKeycloakAdminRole } from "@mis/shared-types";
import { env } from "../config/env";

function hasValidGatewaySecret(provided: string | undefined): boolean {
  if (!provided) return false;
  const expected = Buffer.from(env.gatewaySharedSecret, "utf8");
  const actual = Buffer.from(provided, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function adminContext(req: Request, res: Response, next: NextFunction) {
  if (!hasValidGatewaySecret(req.header("x-gateway-secret"))) {
    return res.status(401).json({ message: "Request must come through API Gateway" });
  }
  const userId = req.header("x-auth-admin-user-id");
  const role = req.header("x-auth-admin-role");
  if (!userId?.trim() || !isKeycloakAdminRole(role) || role !== KEYCLOAK_ADMIN_ROLES.USER_PROVISIONER) {
    return res.status(403).json({ message: "Invalid administrative context" });
  }
  req.adminAuth = { userId, role };
  return next();
}
