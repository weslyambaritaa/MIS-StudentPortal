import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { TrainerProfile } from "./trainer-profile.model";

export class TrainerCertification extends Model {
  declare id: string;
  declare trainer_profile_id: string;
  declare name: string;
  declare expires_at: string;
  declare created_at: Date;
  declare updated_at: Date;
}

TrainerCertification.init({
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
  trainer_profile_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  expires_at: { type: DataTypes.DATEONLY, allowNull: false },
}, {
  sequelize,
  tableName: "trainer_certification",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

TrainerProfile.hasMany(TrainerCertification, { foreignKey: "trainer_profile_id", as: "certifications" });
TrainerCertification.belongsTo(TrainerProfile, { foreignKey: "trainer_profile_id", as: "trainerProfile" });
