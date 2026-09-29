import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";
import { Training } from "./training.model";

export class Participant extends Model {
  declare id: string;
  declare training_id: string;
  declare student_id: string | null;
  declare full_name: string;
  declare registered_at: Date;
  declare created_at: Date;
  declare updated_at: Date;
}

Participant.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    training_id: { type: DataTypes.UUID, allowNull: false },
    // Stable logical reference to Student PostgreSQL; deliberately not a physical FK.
    student_id: { type: DataTypes.UUID, allowNull: true },
    full_name: { type: DataTypes.STRING(200), allowNull: false },
    registered_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "participant",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

Training.hasMany(Participant, { foreignKey: "training_id", as: "participants" });
Participant.belongsTo(Training, { foreignKey: "training_id", as: "training" });
