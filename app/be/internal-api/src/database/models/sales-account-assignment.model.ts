import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";
import { Account } from "./account.model";

export class SalesAccountAssignment extends Model {
  declare id: string;
  declare sales_subject: string;
  declare account_id: string;
  declare assigned_at: Date;
  declare ended_at: Date | null;
  declare assigned_by_subject: string | null;
  declare ended_by_subject: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

SalesAccountAssignment.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    sales_subject: { type: DataTypes.STRING(255), allowNull: false },
    account_id: { type: DataTypes.UUID, allowNull: false },
    assigned_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ended_at: { type: DataTypes.DATE, allowNull: true },
    assigned_by_subject: { type: DataTypes.STRING(255), allowNull: true },
    ended_by_subject: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    tableName: "sales_account_assignment",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        name: "uq_sales_account_one_active_owner",
        unique: true,
        fields: ["account_id"],
        where: { ended_at: null },
      },
      { name: "ix_sales_assignment_subject_active", fields: ["sales_subject", "ended_at"] },
    ],
  },
);

Account.hasMany(SalesAccountAssignment, { foreignKey: "account_id", as: "salesAssignments" });
SalesAccountAssignment.belongsTo(Account, { foreignKey: "account_id", as: "account" });
