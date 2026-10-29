import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export class PicProfile extends Model {
  declare id: string;
  declare keycloak_subject: string;
  declare name: string;
  declare email: string;
  declare status: "PENDING" | "ACTIVE" | "INACTIVE";
  declare activation_expires_at: Date | null;
  declare position: string;
  declare created_at: Date;
  declare updated_at: Date;
}

PicProfile.init({
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
  keycloak_subject: { type: DataTypes.STRING(255), allowNull: false, unique: "uq_pic_profile_keycloak_subject" },
  name: { type: DataTypes.STRING(200), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: false, unique: "uq_pic_profile_email" },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "PENDING" },
  activation_expires_at: { type: DataTypes.DATE, allowNull: true },
  position: { type: DataTypes.STRING(255), allowNull: false },
}, {
  sequelize,
  tableName: "pic_profile",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

