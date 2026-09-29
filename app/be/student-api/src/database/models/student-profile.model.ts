import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";

export class StudentProfile extends Model {
  declare student_id: string;
  declare keycloak_subject: string;
  declare created_at: Date;
  declare updated_at: Date;
}

StudentProfile.init(
  {
    student_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    keycloak_subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: "uq_student_profile_keycloak_subject",
    },
  },
  {
    sequelize,
    tableName: "student_profile",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
