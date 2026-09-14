import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";
import { env } from "../config/env";
import { keycloakJwks } from "../auth/jwks";
import type { KeycloakJwtPayload } from "../auth/auth.types";

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
    const roles = typed.realm_access?.roles ?? [];
    req.auth = { payload: typed, roles };

    // Never trust identity headers from the browser; overwrite them here.
    req.headers["x-auth-user-id"] = typed.sub ?? "";
    req.headers["x-auth-user-email"] = typed.email ?? "";
    req.headers["x-auth-user-roles"] = roles.join(",");
    req.headers["x-gateway-secret"] = env.gatewaySharedSecret;

    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}
