import { DataTypes, Model } from "sequelize";

import type { BusinessRole, ResourceGroup } from "@mis/shared-types";
import { sequelize } from "../sequelize";

export class RoleAccessMatrix extends Model {
  declare id: string;
  declare role: BusinessRole;
  declare resource_group: ResourceGroup;
  declare can_view: boolean;
  declare can_create: boolean;
  declare can_edit: boolean;
  declare can_delete: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

RoleAccessMatrix.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    role: { type: DataTypes.STRING(20), allowNull: false },
    resource_group: { type: DataTypes.STRING(50), allowNull: false },
    can_view: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    can_create: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    can_edit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    can_delete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    tableName: "role_access_matrix",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        name: "uq_role_access_matrix_role_resource",
        unique: true,
        fields: ["role", "resource_group"],
      },
    ],
  },
);
