// Compatibility re-exports while call sites migrate to the shared package.
export {
  BUSINESS_ROLES,
  BUSINESS_ROLE_ORDER,
  EXTERNAL_ROLES,
  INTERNAL_ROLES,
  isBusinessRole,
  isExternalRole,
  isInternalRole,
  isRole,
  ROLES,
} from "@mis/shared-types";
export type { BusinessRole, ExternalRole, InternalRole, Role } from "@mis/shared-types";
