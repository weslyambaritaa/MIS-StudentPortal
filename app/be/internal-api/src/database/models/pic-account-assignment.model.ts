import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";
import { Account } from "./account.model";
import { PicProfile } from "./pic-profile.model";

export class PicAccountAssignment extends Model {
  declare id: string;
  declare pic_profile_id: string;
  declare account_id: string;
  declare assigned_at: Date;
  declare ended_at: Date | null;
  declare assigned_by_subject: string | null;
  declare ended_by_subject: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

PicAccountAssignment.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    pic_profile_id: { type: DataTypes.UUID, allowNull: false },
    account_id: { type: DataTypes.UUID, allowNull: false },
    assigned_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ended_at: { type: DataTypes.DATE, allowNull: true },
    assigned_by_subject: { type: DataTypes.STRING(255), allowNull: true },
    ended_by_subject: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    tableName: "pic_account_assignment",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        name: "uq_pic_one_active_account",
        unique: true,
        fields: ["pic_profile_id"],
        where: { ended_at: null },
      },
      { name: "ix_pic_account_assignment_account_active", fields: ["account_id", "ended_at"] },
    ],
  },
);

PicProfile.hasMany(PicAccountAssignment, { foreignKey: "pic_profile_id", as: "accountAssignments" });
PicAccountAssignment.belongsTo(PicProfile, { foreignKey: "pic_profile_id", as: "picProfile" });
Account.hasMany(PicAccountAssignment, { foreignKey: "account_id", as: "picAssignments" });
PicAccountAssignment.belongsTo(Account, { foreignKey: "account_id", as: "account" });
