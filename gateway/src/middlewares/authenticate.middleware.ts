import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";
import { env } from "../config/env";
import { keycloakJwks } from "../auth/jwks";
import type { KeycloakJwtPayload } from "../auth/auth.types";
import { isBusinessRole } from "@mis/shared-types";
import {
  overwriteTrustedAuthHeaders,
  validateActiveRole,
} from "../auth/active-role";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const { payload } = await jwtVerify(token, keycloakJwks, {
      issuer: env.keycloakIssuer,
      audience: env.keycloakAudience,
    });

    const typed = payload as KeycloakJwtPayload;
    const roles = (typed.realm_access?.roles ?? []).filter(isBusinessRole);
    const activeRole = validateActiveRole(roles, req.header("x-active-role"));
    if (!activeRole) {
      return res.status(403).json({ message: "Invalid active role" });
    }
    if (!typed.sub) {
      return res.status(401).json({ message: "Authenticated user identity is missing" });
    }

    req.auth = { payload: typed, roles, activeRole };

    // Remove client-selected context and replace every trusted downstream header.
    overwriteTrustedAuthHeaders(
      req.headers,
      { userId: typed.sub, email: typed.email, roles, activeRole },
      env.gatewaySharedSecret,
    );

    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}
