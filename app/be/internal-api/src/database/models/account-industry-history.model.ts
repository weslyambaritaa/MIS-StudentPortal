import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

/** Append-only record of every Account-to-Industry assignment, including ended use. */
export class AccountIndustryHistory extends Model {
  declare id: string;
  declare account_id: string;
  declare industry_id: string;
  declare assigned_at: Date;
}

AccountIndustryHistory.init({
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
  account_id: { type: DataTypes.UUID, allowNull: false },
  industry_id: { type: DataTypes.UUID, allowNull: false },
  assigned_at: { type: DataTypes.DATE, allowNull: false },
}, {
  sequelize,
  tableName: "account_industry_history",
  timestamps: false,
  indexes: [
    { name: "ix_account_industry_history_industry", fields: ["industry_id"] },
    { name: "ix_account_industry_history_account", fields: ["account_id", "assigned_at"] },
  ],
});
