import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";

export class RemoteLab extends Model {
  declare id: string;
  /** Logical reference to Internal SQL Server training.id; deliberately no FK. */
  declare training_id: string;
  declare lab_url: string;
  declare start_period: Date | null;
  declare end_period: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

RemoteLab.init({
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
  training_id: { type: DataTypes.UUID, allowNull: false },
  lab_url: { type: DataTypes.STRING(255), allowNull: false },
  start_period: { type: DataTypes.DATEONLY, allowNull: true },
  end_period: { type: DataTypes.DATEONLY, allowNull: true },
}, { sequelize, tableName: "remote_lab", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", indexes: [{ name: "uq_remote_lab_training_id", unique: true, fields: ["training_id"] }] });
