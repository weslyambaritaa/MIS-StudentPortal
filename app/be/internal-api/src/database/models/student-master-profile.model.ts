import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

/** Admin-managed Student data. Keycloak remains the identity and role authority. */
export class StudentMasterProfile extends Model {
  declare id: string;
  declare keycloak_subject: string;
  declare student_id: string | null;
  declare account_id: string;
  declare name: string;
  declare email: string;
  declare company_role: string | null;
  declare portal_enabled: boolean;
  declare first_login_at: Date | null;
  declare last_login_at: Date | null;
  declare activation_expires_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

StudentMasterProfile.init({
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
  keycloak_subject: { type: DataTypes.STRING(255), allowNull: false, unique: "uq_student_master_keycloak_subject" },
  student_id: { type: DataTypes.UUID, allowNull: true },
  account_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: false },
  company_role: { type: DataTypes.STRING(200), allowNull: true },
  portal_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  first_login_at: { type: DataTypes.DATE, allowNull: true },
  last_login_at: { type: DataTypes.DATE, allowNull: true },
  activation_expires_at: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  tableName: "student_master_profile",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    { name: "uq_student_master_email", unique: true, fields: ["email"] },
    { name: "ix_student_master_account", fields: ["account_id", "name"] },
  ],
});
