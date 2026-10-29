import { ROLES, type BusinessRole } from "@mis/shared-types";

/** Roles served by MIS Internal. Student and PIC use Student Portal. */
export const MIS_PORTAL_ROLES = [
  ROLES.TRAINER,
  ROLES.SALES,
  ROLES.ADMIN,
  ROLES.FINANCE,
  ROLES.MANAGEMENT,
] as const satisfies readonly BusinessRole[];

export type MisPortalRole = (typeof MIS_PORTAL_ROLES)[number];
