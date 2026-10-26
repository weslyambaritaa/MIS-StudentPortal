import { DataTypes, Model, Op } from "sequelize";

import { sequelize } from "../sequelize";

export type AccountType = "CORPORATE" | "PERSONAL";

export class Account extends Model {
  declare id: string;
  declare account_code: string;
  declare name: string;
  declare account_type: AccountType;
  declare industry_id: string;
  declare personal_student_subject: string | null;
  declare status: "ACTIVE" | "INACTIVE";
  declare created_at: Date;
  declare updated_at: Date;
}

Account.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    account_code: { type: DataTypes.STRING(20), allowNull: false },
    name: { type: DataTypes.STRING(200), allowNull: false },
    account_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [["CORPORATE", "PERSONAL"]] },
    },
    industry_id: { type: DataTypes.UUID, allowNull: false },
    // Keycloak subject is a logical cross-service identity; intentionally no cross-DB FK.
    personal_student_subject: { type: DataTypes.STRING(255), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ACTIVE", validate: { isIn: [["ACTIVE", "INACTIVE"]] } },
  },
  {
    sequelize,
    tableName: "account",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "uq_account_account_code", unique: true, fields: ["account_code"] },
      { name: "uq_account_personal_student_subject", unique: true, fields: ["personal_student_subject"], where: { personal_student_subject: { [Op.ne]: null } } },
    ],
  },
);
