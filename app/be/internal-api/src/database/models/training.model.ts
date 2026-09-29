import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";
import { Account } from "./account.model";

export class Training extends Model {
  declare id: string;
  declare account_id: string;
  declare name: string;
  declare course_id: string | null;
  declare request_form_id: string | null;
  declare training_type: "PUBLIC" | "PRIVATE" | null;
  declare status: "DRAFT" | "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED";
  declare created_at: Date;
  declare updated_at: Date;
}

Training.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    account_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(200), allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: true },
    request_form_id: { type: DataTypes.UUID, allowNull: true },
    training_type: { type: DataTypes.STRING(20), allowNull: true, validate: { isIn: [["PUBLIC", "PRIVATE"]] } },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "DRAFT", validate: { isIn: [["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]] } },
  },
  { sequelize, tableName: "training", timestamps: true, createdAt: "created_at", updatedAt: "updated_at" },
);

Account.hasMany(Training, { foreignKey: "account_id", as: "trainings" });
Training.belongsTo(Account, { foreignKey: "account_id", as: "account" });
