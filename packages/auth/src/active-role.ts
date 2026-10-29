/** Return allowed token roles in the order selected by the consuming application. */
export function getAvailableRoles<Role extends string>(
  allowedRoles: readonly Role[],
  tokenRoles: readonly string[] = [],
): Role[] {
  const tokenRoleSet = new Set(tokenRoles);
  return allowedRoles.filter((role) => tokenRoleSet.has(role));
}

export function resolveActiveRole<Role extends string>(
  availableRoles: readonly Role[],
  storedRole: unknown,
): Role | null {
  if (availableRoles.length === 0) return null;
  if (availableRoles.length === 1) return availableRoles[0];
  if (typeof storedRole === "string" && availableRoles.includes(storedRole as Role)) return storedRole as Role;
  return availableRoles[0];
}

export function getSelectableActiveRole<Role extends string>(
  availableRoles: readonly Role[],
  requestedRole: unknown,
): Role | null {
  return typeof requestedRole === "string" && availableRoles.includes(requestedRole as Role)
    ? requestedRole as Role
    : null;
}
