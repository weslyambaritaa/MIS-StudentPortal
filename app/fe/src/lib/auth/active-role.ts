import {
  BUSINESS_ROLE_ORDER,
  isBusinessRole,
  type BusinessRole,
} from "@mis/shared-types";

export const ACTIVE_ROLE_STORAGE_KEY = "mis-active-role";

/** Sort only recognized business roles; JWT claim ordering has no business meaning. */
export function getAvailableBusinessRoles(tokenRoles: readonly string[] = []): BusinessRole[] {
  const tokenRoleSet = new Set(tokenRoles.filter(isBusinessRole));
  return BUSINESS_ROLE_ORDER.filter((role) => tokenRoleSet.has(role));
}

export function resolveActiveRole(
  availableRoles: readonly BusinessRole[],
  storedRole: unknown,
): BusinessRole | null {
  if (availableRoles.length === 0) return null;
  if (availableRoles.length === 1) return availableRoles[0];
  if (isBusinessRole(storedRole) && availableRoles.includes(storedRole)) return storedRole;
  return BUSINESS_ROLE_ORDER.find((role) => availableRoles.includes(role)) ?? null;
}

export function getSelectableActiveRole(
  availableRoles: readonly BusinessRole[],
  requestedRole: unknown,
): BusinessRole | null {
  return isBusinessRole(requestedRole) && availableRoles.includes(requestedRole)
    ? requestedRole
    : null;
}
