import type { ActiveRoleAuthContext } from "@mis/shared-types";

declare global {
  namespace Express {
    interface Request {
      auth?: ActiveRoleAuthContext;
    }
  }
}

export {};
