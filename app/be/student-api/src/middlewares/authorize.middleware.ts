import type { NextFunction, Request, Response } from "express";
import type { Role } from "@mis/shared-types";

export function authorizeActiveRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth && roles.includes(req.auth.activeRole)) return next();
    return res.status(403).json({ message: "Forbidden" });
  };
}
