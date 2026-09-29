import { DataTypes, Model, Op } from "sequelize";

import { sequelize } from "../sequelize";
import { TrainingSession } from "./training-session.model";
import { SessionTrainerAssignment } from "./session-trainer-assignment.model";
import { TrainingTrainerAssignment } from "./training-trainer-assignment.model";

export class SessionTrainerReplacement extends Model {
  declare id: string;
  declare session_id: string;
  declare substitute_assignment_id: string;
  declare replaced_training_assignment_id: string | null;
  declare replaced_session_assignment_id: string | null;
  declare assigned_at: Date;
  declare ended_at: Date | null;
  declare assigned_by_subject: string | null;
  declare ended_by_subject: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

SessionTrainerReplacement.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    session_id: { type: DataTypes.UUID, allowNull: false },
    substitute_assignment_id: { type: DataTypes.UUID, allowNull: false },
    replaced_training_assignment_id: { type: DataTypes.UUID, allowNull: true },
    replaced_session_assignment_id: { type: DataTypes.UUID, allowNull: true },
    assigned_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ended_at: { type: DataTypes.DATE, allowNull: true },
    assigned_by_subject: { type: DataTypes.STRING(255), allowNull: true },
    ended_by_subject: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    tableName: "session_trainer_replacement",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        name: "uq_session_trainer_replacement_active_substitute",
        unique: true,
        fields: ["substitute_assignment_id"],
        where: { ended_at: null },
      },
      {
        name: "uq_session_trainer_replacement_active_training_source",
        unique: true,
        fields: ["session_id", "replaced_training_assignment_id"],
        where: { ended_at: null, replaced_training_assignment_id: { [Op.ne]: null } },
      },
      {
        name: "uq_session_trainer_replacement_active_session_source",
        unique: true,
        fields: ["session_id", "replaced_session_assignment_id"],
        where: { ended_at: null, replaced_session_assignment_id: { [Op.ne]: null } },
      },
    ],
  },
);

TrainingSession.hasMany(SessionTrainerReplacement, { foreignKey: "session_id", as: "trainerReplacements" });
SessionTrainerReplacement.belongsTo(TrainingSession, { foreignKey: "session_id", as: "session" });
SessionTrainerAssignment.hasMany(SessionTrainerReplacement, {
  foreignKey: "substitute_assignment_id",
  as: "replacementRecords",
});
SessionTrainerReplacement.belongsTo(SessionTrainerAssignment, {
  foreignKey: "substitute_assignment_id",
  as: "substituteAssignment",
});
SessionTrainerAssignment.hasMany(SessionTrainerReplacement, {
  foreignKey: "replaced_session_assignment_id",
  as: "replacedSessionRecords",
});
SessionTrainerReplacement.belongsTo(TrainingTrainerAssignment, {
  foreignKey: "replaced_training_assignment_id",
  as: "replacedTrainingAssignment",
});
TrainingTrainerAssignment.hasMany(SessionTrainerReplacement, {
  foreignKey: "replaced_training_assignment_id",
  as: "replacedTrainingRecords",
});
