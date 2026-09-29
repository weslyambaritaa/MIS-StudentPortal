import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";
import { TrainerProfile } from "./trainer-profile.model";
import { Training } from "./training.model";

export type TrainingTrainerAssignmentType = "PRIMARY" | "ASSISTANT";

export class TrainingTrainerAssignment extends Model {
  declare id: string;
  declare training_id: string;
  declare trainer_profile_id: string;
  declare assignment_type: TrainingTrainerAssignmentType;
  declare assigned_at: Date;
  declare ended_at: Date | null;
  declare assigned_by_subject: string | null;
  declare ended_by_subject: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

TrainingTrainerAssignment.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    training_id: { type: DataTypes.UUID, allowNull: false },
    trainer_profile_id: { type: DataTypes.UUID, allowNull: false },
    assignment_type: { type: DataTypes.STRING(20), allowNull: false },
    assigned_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ended_at: { type: DataTypes.DATE, allowNull: true },
    assigned_by_subject: { type: DataTypes.STRING(255), allowNull: true },
    ended_by_subject: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    tableName: "training_trainer_assignment",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

Training.hasMany(TrainingTrainerAssignment, { foreignKey: "training_id", as: "trainerAssignments" });
TrainingTrainerAssignment.belongsTo(Training, { foreignKey: "training_id", as: "training" });
TrainerProfile.hasMany(TrainingTrainerAssignment, { foreignKey: "trainer_profile_id", as: "trainingAssignments" });
TrainingTrainerAssignment.belongsTo(TrainerProfile, { foreignKey: "trainer_profile_id", as: "trainerProfile" });
