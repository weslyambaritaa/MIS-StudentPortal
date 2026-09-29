import type { NextFunction, Request, Response } from "express";
import { ROLES } from "@mis/shared-types";

import { ensureStudentIdentity } from "../modules/students/student-identity";

/** Run only within the authenticated external API boundary; non-Student roles pass untouched. */
export function ensureStudentIdentityForActiveRole(req: Request, _res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) return next(new Error("Authenticated context is required"));
  if (auth.activeRole !== ROLES.STUDENT) return next();

  ensureStudentIdentity(auth).then(() => next(), next);
}
