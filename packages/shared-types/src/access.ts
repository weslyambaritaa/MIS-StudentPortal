/** Role-level capabilities for business data groups. This does not define data scope. */
export const ACCESS_ACTIONS = {
  VIEW: "VIEW",
  CREATE: "CREATE",
  EDIT: "EDIT",
  DELETE: "DELETE",
} as const;

export type AccessAction = (typeof ACCESS_ACTIONS)[keyof typeof ACCESS_ACTIONS];

/** Canonical resource groups shared by backend services; not sidebar/menu names. */
export const RESOURCE_GROUPS = [
  "ACCOUNT",
  "PIC",
  "STUDENT",
  "TRAINER",
  "INDUSTRY",
  "COURSE",
  "COURSE_CATEGORY",
  "QUOTATION",
  "REQUEST_FORM",
  "TRAINING",
  "TRAINING_SESSION",
  "PARTICIPANT",
  "ATTENDANCE",
  "EVALUATION",
  "CERTIFICATE",
  "INVOICE",
  "ROOM",
  "ROOM_BOOKING",
  "CLASS_MATERIAL",
  "REMOTE_LAB",
] as const;

export type ResourceGroup = (typeof RESOURCE_GROUPS)[number];

export function isAccessAction(value: unknown): value is AccessAction {
  return typeof value === "string" && Object.values(ACCESS_ACTIONS).includes(value as AccessAction);
}

export function isResourceGroup(value: unknown): value is ResourceGroup {
  return typeof value === "string" && RESOURCE_GROUPS.includes(value as ResourceGroup);
}
