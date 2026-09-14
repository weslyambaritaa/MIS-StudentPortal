import type { KeycloakJwtPayload } from "../auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        payload: KeycloakJwtPayload;
        roles: string[];
      };
    }
  }
}

export {};
