import {
  getAvailableRoles,
  getSelectableActiveRole as selectSharedActiveRole,
  resolveActiveRole as resolveSharedActiveRole,
} from "@mis/auth";
import { MIS_PORTAL_ROLES, type MisPortalRole } from "@/config/portal-roles";

/** MIS role preference is app-specific; shared auth code receives an allowed-role list. */
export const ACTIVE_ROLE_STORAGE_KEY = "mis-active-role";

export function getAvailableBusinessRoles(tokenRoles: readonly string[] = []): MisPortalRole[] {
  return getAvailableRoles(MIS_PORTAL_ROLES, tokenRoles);
}

export function resolveActiveRole(
  availableRoles: readonly MisPortalRole[],
  storedRole: unknown,
): MisPortalRole | null {
  return resolveSharedActiveRole(availableRoles, storedRole);
}

export function getSelectableActiveRole(
  availableRoles: readonly MisPortalRole[],
  requestedRole: unknown,
): MisPortalRole | null {
  return selectSharedActiveRole(availableRoles, requestedRole);
}
