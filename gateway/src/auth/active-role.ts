import {
  isBusinessRole,
  type Role,
} from "@mis/shared-types";

export function validateActiveRole(tokenRoles: readonly Role[], requestedRole: unknown): Role | null {
  if (!isBusinessRole(requestedRole) || !tokenRoles.includes(requestedRole)) return null;
  return requestedRole;
}

export function isRoleWithinBoundary(activeRole: Role | undefined, allowedRoles: readonly Role[]) {
  return activeRole !== undefined && allowedRoles.includes(activeRole);
}

export type TrustedAuthContext = {
  userId: string;
  email?: string;
  clientIp?: string;
  roles: readonly Role[];
  activeRole: Role;
};

export function overwriteTrustedAuthHeaders(
  headers: Record<string, string | string[] | undefined>,
  auth: TrustedAuthContext,
  gatewaySecret: string,
) {
  delete headers["x-active-role"];
  headers["x-auth-user-id"] = auth.userId;
  headers["x-auth-user-email"] = auth.email ?? "";
  headers["x-auth-user-roles"] = auth.roles.join(",");
  headers["x-auth-active-role"] = auth.activeRole;
  delete headers["x-auth-client-ip"];
  headers["x-auth-client-ip"] = auth.clientIp ?? "";
  headers["x-gateway-secret"] = gatewaySecret;
}
