import type { NextFunction, Request, Response } from "express";
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const actual = req.auth?.roles ?? [];
    if (actual.includes("super_admin") || actual.some((role) => roles.includes(role))) return next();
    return res.status(403).json({ message: "Forbidden" });
  };
}
