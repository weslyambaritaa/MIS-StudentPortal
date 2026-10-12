import {
  isAccessAction,
  isBusinessRole,
  isResourceGroup,
  type AccessAction,
} from "@mis/shared-types";

import { RoleAccessMatrix } from "../../database/models/role-access-matrix.model";

const actionColumn = {
  VIEW: "can_view",
  CREATE: "can_create",
  EDIT: "can_edit",
  DELETE: "can_delete",
} as const;

/**
 * Resolves only role-level capability. Data ownership/scope and business rules
 * must be applied by the domain query/service after this check.
 */
export async function canRoleAccess(
  role: unknown,
  resourceGroup: unknown,
  action: unknown,
): Promise<boolean> {
  if (!isBusinessRole(role) || !isResourceGroup(resourceGroup) || !isAccessAction(action)) {
    return false;
  }

  const column = actionColumn[action as AccessAction];
  const row = await RoleAccessMatrix.findOne({
    attributes: [column],
    where: { role, resource_group: resourceGroup },
    raw: true,
  });

  if (!row) return false;
  return row[column] === true;
}
