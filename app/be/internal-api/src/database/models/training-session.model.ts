import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";
import { Training } from "./training.model";

export class TrainingSession extends Model {
  declare id: string;
  declare training_id: string;
  declare session_number: number;
  declare starts_at: Date;
  declare ends_at: Date;
  declare class_location: "ONLINE" | "OFFLINE" | "HYBRID" | null;
  declare zoom_url: string | null;
  declare agenda: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

TrainingSession.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    training_id: { type: DataTypes.UUID, allowNull: false },
    session_number: { type: DataTypes.INTEGER, allowNull: false },
    starts_at: { type: DataTypes.DATE, allowNull: false },
    ends_at: { type: DataTypes.DATE, allowNull: false },
    class_location: { type: DataTypes.STRING(20), allowNull: true, validate: { isIn: [["ONLINE", "OFFLINE", "HYBRID"]] } },
    zoom_url: { type: DataTypes.STRING(255), allowNull: true },
    agenda: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    tableName: "training_session",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

Training.hasMany(TrainingSession, { foreignKey: "training_id", as: "sessions" });
TrainingSession.belongsTo(Training, { foreignKey: "training_id", as: "training" });
