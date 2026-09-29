import type { KeycloakJwtPayload } from "../auth/auth.types";
import type { Role } from "@mis/shared-types";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        payload: KeycloakJwtPayload;
        roles: Role[];
        activeRole: Role;
      };
    }
  }
}

export {};
