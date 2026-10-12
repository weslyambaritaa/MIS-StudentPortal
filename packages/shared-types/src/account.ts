/** Account provenance is metadata; it is not a role or authorization grant. */
export const ACCOUNT_SOURCES = {
  MANUAL: "MANUAL",
  AUTOMATIC: "AUTOMATIC",
} as const;

export type AccountSource = (typeof ACCOUNT_SOURCES)[keyof typeof ACCOUNT_SOURCES];

/** Administrative identity roles are deliberately separate from business Role/activeRole. */
export const KEYCLOAK_ADMIN_ROLES = {
  USER_PROVISIONER: "mis-user-provisioner",
} as const;

export type KeycloakAdminRole = (typeof KEYCLOAK_ADMIN_ROLES)[keyof typeof KEYCLOAK_ADMIN_ROLES];

export function isAccountSource(value: unknown): value is AccountSource {
  return value === ACCOUNT_SOURCES.MANUAL || value === ACCOUNT_SOURCES.AUTOMATIC;
}

export function isKeycloakAdminRole(value: unknown): value is KeycloakAdminRole {
  return value === KEYCLOAK_ADMIN_ROLES.USER_PROVISIONER;
}
