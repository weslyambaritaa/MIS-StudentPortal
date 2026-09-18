import {
  EXTERNAL_ROLES,
  INTERNAL_ROLES,
  type BusinessRole,
} from "./roles";

export function hasRole(
  userRoles: readonly BusinessRole[],
  role: BusinessRole,
) {
  return userRoles.includes(role);
}

export function hasAnyRole(
  userRoles: readonly BusinessRole[],
  allowedRoles: readonly BusinessRole[],
) {
  return allowedRoles.some((role) =>
    userRoles.includes(role),
  );
}

export function isExternalUser(
  userRoles: readonly BusinessRole[],
) {
  return hasAnyRole(
    userRoles,
    EXTERNAL_ROLES,
  );
}

export function isInternalUser(
  userRoles: readonly BusinessRole[],
) {
  return hasAnyRole(
    userRoles,
    INTERNAL_ROLES,
  );
}

export function isSuperAdmin(
  userRoles: readonly BusinessRole[],
) {
  return userRoles.includes(
    "super_admin",
  );
}