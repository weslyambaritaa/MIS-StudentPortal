import type { AccessAction, ResourceGroup } from "@mis/shared-types";
import type { NextFunction, Request, Response } from "express";

import { canRoleAccess } from "../modules/authorization/role-access-matrix.service";

/** Checks capability against the validated active role; never reads role from request data. */
export function authorizeCapability(resourceGroup: ResourceGroup, action: AccessAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const activeRole = req.auth?.activeRole;
    if (!activeRole) return res.status(403).json({ message: "Forbidden" });

    try {
      if (!(await canRoleAccess(activeRole, resourceGroup, action))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      return next();
    } catch (error) {
      // A matrix/database failure must never turn into an allow decision.
      return next(error);
    }
  };
}
