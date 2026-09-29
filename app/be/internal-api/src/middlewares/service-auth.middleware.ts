import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { isBusinessRole, isRole, type Role } from "@mis/shared-types";

import { env } from "../config/env";

function hasValidServiceSecret(provided: string | undefined): boolean {
  if (!provided) return false;
  const expectedBuffer = Buffer.from(env.serviceSharedSecret, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function parseRoles(value: string | undefined): Role[] | null {
  if (!value) return null;
  const roleNames = value.split(",").map((role) => role.trim());
  if (roleNames.length === 0 || roleNames.some((role) => !isBusinessRole(role))) return null;
  if (new Set(roleNames).size !== roleNames.length) return null;
  return roleNames as Role[];
}

export function serviceAuth(req: Request, res: Response, next: NextFunction) {
  if (!hasValidServiceSecret(req.header("x-service-secret"))) {
    return res.status(401).json({ message: "Invalid service credentials" });
  }

  const userId = req.header("x-actor-user-id");
  const roles = parseRoles(req.header("x-actor-roles"));
  const activeRole = req.header("x-actor-active-role");

  if (!userId?.trim() || !roles || !isRole(activeRole) || !roles.includes(activeRole)) {
    return res.status(403).json({ message: "Invalid service actor context" });
  }

  req.auth = { userId, roles, activeRole };
  return next();
}
