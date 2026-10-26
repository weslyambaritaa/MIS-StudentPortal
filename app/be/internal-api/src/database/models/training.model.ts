import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";
import { Account } from "./account.model";
import { PicProfile } from "./pic-profile.model";

export class Training extends Model {
  declare id: string;
  declare account_id: string;
  declare name: string;
  declare course_id: string;
  declare syllabus_id: string | null;
  declare request_form_id: string;
  declare pic_profile_id: string | null;
  declare expected_students: number | null;
  declare training_type: "PUBLIC" | "PRIVATE" | "INHOUSE" | "ONLINE_PUBLIC" | "ONLINE_PRIVATE";
  declare base_fee: number | null;
  declare status: "DRAFT" | "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED";
  declare created_at: Date;
  declare updated_at: Date;
}

Training.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    account_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    syllabus_id: { type: DataTypes.UUID, allowNull: true },
    request_form_id: { type: DataTypes.UUID, allowNull: false },
    pic_profile_id: { type: DataTypes.UUID, allowNull: true },
    expected_students: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1 } },
    training_type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [["PUBLIC", "PRIVATE", "INHOUSE", "ONLINE_PUBLIC", "ONLINE_PRIVATE"]] } },
    base_fee: { type: DataTypes.DECIMAL(19, 4), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "DRAFT", validate: { isIn: [["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]] } },
  },
  { sequelize, tableName: "training", timestamps: true, createdAt: "created_at", updatedAt: "updated_at" },
);

Account.hasMany(Training, { foreignKey: "account_id", as: "trainings" });
Training.belongsTo(Account, { foreignKey: "account_id", as: "account" });
Training.belongsTo(PicProfile, { foreignKey: "pic_profile_id", as: "pic" });
