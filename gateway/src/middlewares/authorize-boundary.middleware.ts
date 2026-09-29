import type { NextFunction, Request, Response } from "express";
import type { Role } from "@mis/shared-types";
import { isRoleWithinBoundary } from "../auth/active-role";

export function authorizeBoundary(allowedRoles: readonly Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isRoleWithinBoundary(req.auth?.activeRole, allowedRoles)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}
