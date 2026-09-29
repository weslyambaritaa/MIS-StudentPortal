import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";
import { TrainerProfile } from "./trainer-profile.model";
import { TrainingSession } from "./training-session.model";

export type SessionTrainerAssignmentType = "ASSISTANT" | "SUBSTITUTE";

export class SessionTrainerAssignment extends Model {
  declare id: string;
  declare session_id: string;
  declare trainer_profile_id: string;
  declare assignment_type: SessionTrainerAssignmentType;
  declare assigned_at: Date;
  declare ended_at: Date | null;
  declare assigned_by_subject: string | null;
  declare ended_by_subject: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

SessionTrainerAssignment.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    session_id: { type: DataTypes.UUID, allowNull: false },
    trainer_profile_id: { type: DataTypes.UUID, allowNull: false },
    assignment_type: { type: DataTypes.STRING(20), allowNull: false },
    assigned_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ended_at: { type: DataTypes.DATE, allowNull: true },
    assigned_by_subject: { type: DataTypes.STRING(255), allowNull: true },
    ended_by_subject: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    tableName: "session_trainer_assignment",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

TrainingSession.hasMany(SessionTrainerAssignment, { foreignKey: "session_id", as: "trainerAssignments" });
SessionTrainerAssignment.belongsTo(TrainingSession, { foreignKey: "session_id", as: "session" });
TrainerProfile.hasMany(SessionTrainerAssignment, { foreignKey: "trainer_profile_id", as: "sessionAssignments" });
SessionTrainerAssignment.belongsTo(TrainerProfile, { foreignKey: "trainer_profile_id", as: "trainerProfile" });
