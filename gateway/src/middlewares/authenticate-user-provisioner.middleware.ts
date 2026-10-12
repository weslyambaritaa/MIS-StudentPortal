import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";
import { KEYCLOAK_ADMIN_ROLES, isKeycloakAdminRole } from "@mis/shared-types";
import { env } from "../config/env";
import { keycloakJwks } from "../auth/jwks";
import type { KeycloakJwtPayload } from "../auth/auth.types";

export function getUserProvisionerRole(roles: readonly string[]): string | null {
  return roles.find((role) => isKeycloakAdminRole(role) && role === KEYCLOAK_ADMIN_ROLES.USER_PROVISIONER) ?? null;
}

export function overwriteTrustedAdminHeaders(
  headers: Record<string, string | string[] | undefined>,
  userId: string,
  adminRole: string,
  gatewaySecret: string,
) {
  for (const header of [
    "x-active-role", "x-auth-user-id", "x-auth-user-email", "x-auth-user-roles",
    "x-auth-active-role", "x-auth-admin-user-id", "x-auth-admin-role", "x-gateway-secret",
  ]) delete headers[header];
  headers["x-auth-admin-user-id"] = userId;
  headers["x-auth-admin-role"] = adminRole;
  headers["x-gateway-secret"] = gatewaySecret;
}

/** Administrative identity is separate from business activeRole and is only used on the account provisioning route. */
export async function authenticateUserProvisioner(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });

  try {
    const { payload } = await jwtVerify(authorization.slice("Bearer ".length), keycloakJwks, {
      issuer: env.keycloakIssuer,
      audience: env.keycloakAudience,
    });
    const typed = payload as KeycloakJwtPayload;
    const roles = typed.realm_access?.roles ?? [];
    const adminRole = getUserProvisionerRole(roles);
    if (!typed.sub || !adminRole) return res.status(403).json({ message: "Forbidden" });

    // Never forward client-provided trusted context; the Internal API validates the gateway secret too.
    overwriteTrustedAdminHeaders(req.headers, typed.sub, adminRole, env.gatewaySharedSecret);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}
