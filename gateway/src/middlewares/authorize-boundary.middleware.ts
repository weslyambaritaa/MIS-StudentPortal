import type { NextFunction, Request, Response } from "express";

export function authorizeBoundary(allowedRoles: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roles = req.auth?.roles ?? [];
    if (roles.includes("super_admin")) return next();
    if (!roles.some((role) => allowedRoles.includes(role))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}
