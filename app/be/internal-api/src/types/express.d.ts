import type { ActiveRoleAuthContext } from "@mis/shared-types";

declare global {
  namespace Express {
    interface Request {
      auth?: ActiveRoleAuthContext;
      adminAuth?: { userId: string; role: "mis-user-provisioner" };
    }
  }
}

export {};
