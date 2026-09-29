/** The business roles recognized by MIS. Infrastructure administrators are not business roles. */
export const ROLES = {
  STUDENT: "student",
  PIC: "pic",
  TRAINER: "trainer",
  SALES: "sales",
  ADMIN: "admin",
  FINANCE: "finance",
  MANAGEMENT: "management",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
export type BusinessRole = Role;

export const BUSINESS_ROLES = [
  ROLES.STUDENT,
  ROLES.PIC,
  ROLES.TRAINER,
  ROLES.SALES,
  ROLES.ADMIN,
  ROLES.FINANCE,
  ROLES.MANAGEMENT,
] as const satisfies readonly Role[];

/** Deterministic default order; never infer business priority from JWT claim ordering. */
export const BUSINESS_ROLE_ORDER = BUSINESS_ROLES;

export const EXTERNAL_ROLES = [ROLES.STUDENT, ROLES.PIC, ROLES.TRAINER] as const;
export const INTERNAL_ROLES = [ROLES.SALES, ROLES.ADMIN, ROLES.FINANCE, ROLES.MANAGEMENT] as const;

export type ExternalRole = (typeof EXTERNAL_ROLES)[number];
export type InternalRole = (typeof INTERNAL_ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && BUSINESS_ROLES.includes(value as Role);
}

export const isBusinessRole = isRole;

export function isExternalRole(value: unknown): value is ExternalRole {
  return typeof value === "string" && EXTERNAL_ROLES.includes(value as ExternalRole);
}

export function isInternalRole(value: unknown): value is InternalRole {
  return typeof value === "string" && INTERNAL_ROLES.includes(value as InternalRole);
}
