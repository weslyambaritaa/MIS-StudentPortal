import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { isBusinessRole, isRole, type Role } from "@mis/shared-types";
import { env } from "../config/env";

function validSecret(value: string | undefined) {
  if (!value) return false;
  const expected = Buffer.from(env.serviceSharedSecret, "utf8");
  const actual = Buffer.from(value, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function serviceAuth(req: Request, res: Response, next: NextFunction) {
  if (!validSecret(req.header("x-service-secret"))) return res.status(401).json({ message: "Invalid service credentials" });
  const userId = req.header("x-actor-user-id");
  const roleNames = (req.header("x-actor-roles") ?? "").split(",").map((role) => role.trim()).filter(Boolean);
  const activeRole = req.header("x-actor-active-role");
  if (!userId?.trim() || !roleNames.length || !roleNames.every(isBusinessRole) || !isRole(activeRole) || !roleNames.includes(activeRole)) {
    return res.status(403).json({ message: "Invalid service actor context" });
  }
  const email = req.header("x-actor-user-email");
  req.auth = { userId, roles: roleNames as Role[], activeRole, ...(email ? { email } : {}) };
  return next();
}

