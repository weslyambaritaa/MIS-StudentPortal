import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";

export class TrainerProfile extends Model {
  declare id: string;
  declare keycloak_subject: string;
  declare trainer_code: string | null;
  declare name: string | null;
  declare email: string | null;
  declare specialization: string;
  declare certification_expired: Date | null;
  declare rating: number;
  declare status: "PENDING" | "ACTIVE" | "INACTIVE";
  declare first_login_at: Date | null;
  declare activation_expires_at: Date | null;
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
    trainer_code: { type: DataTypes.STRING(50), allowNull: true, unique: "uq_trainer_profile_code" },
    name: { type: DataTypes.STRING(200), allowNull: true },
    email: { type: DataTypes.STRING(254), allowNull: true, unique: "uq_trainer_profile_email" },
    specialization: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    certification_expired: { type: DataTypes.DATEONLY, allowNull: true },
    rating: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ACTIVE" },
    first_login_at: { type: DataTypes.DATE, allowNull: true },
    activation_expires_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: "trainer_profile",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
