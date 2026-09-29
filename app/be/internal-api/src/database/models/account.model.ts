import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";

export type AccountType = "CORPORATE" | "PERSONAL";

export class Account extends Model {
  declare id: string;
  declare name: string;
  declare account_type: AccountType;
  declare industry_id: string | null;
  declare status: "ACTIVE" | "INACTIVE";
  declare created_at: Date;
  declare updated_at: Date;
}

Account.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING(200), allowNull: false },
    account_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [["CORPORATE", "PERSONAL"]] },
    },
    industry_id: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ACTIVE", validate: { isIn: [["ACTIVE", "INACTIVE"]] } },
  },
  { sequelize, tableName: "account", timestamps: true, createdAt: "created_at", updatedAt: "updated_at" },
);
