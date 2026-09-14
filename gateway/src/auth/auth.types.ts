import type { JWTPayload } from "jose";

export interface KeycloakJwtPayload extends JWTPayload {
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}
