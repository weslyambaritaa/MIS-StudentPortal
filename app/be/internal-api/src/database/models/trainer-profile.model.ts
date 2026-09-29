import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";

export class TrainerProfile extends Model {
  declare id: string;
  declare keycloak_subject: string;
  declare specialization: string;
  declare certification_expired: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

TrainerProfile.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    keycloak_subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: "uq_trainer_profile_keycloak_subject",
    },
    specialization: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    certification_expired: { type: DataTypes.DATEONLY, allowNull: true },
  },
  {
    sequelize,
    tableName: "trainer_profile",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
