export const BUSINESS_ROLES = [
  "student",
  "pic",
  "trainer",

  "sales",
  "admin",
  "finance",
  "management",

  "super_admin",
] as const;

export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const EXTERNAL_ROLES: readonly BusinessRole[] = ["student", "pic", "trainer", "super_admin"];

export const INTERNAL_ROLES: readonly BusinessRole[] = [
  "sales",
  "admin",
  "finance",
  "management",
  "super_admin",
];

export const SUPER_ADMIN_ROLE: BusinessRole = "super_admin";

export function isBusinessRole(value: string): value is BusinessRole {
  return BUSINESS_ROLES.includes(value as BusinessRole);
}
