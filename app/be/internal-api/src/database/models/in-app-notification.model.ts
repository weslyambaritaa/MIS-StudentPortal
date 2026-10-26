import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export class InAppNotification extends Model {
  declare id: string;
  declare recipient_subject: string;
  declare event_key: string;
  declare title: string;
  declare message: string;
  declare target_path: string;
  declare created_at: Date;
  declare read_at: Date | null;
}

InAppNotification.init({
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
  recipient_subject: { type: DataTypes.STRING(255), allowNull: false },
  event_key: { type: DataTypes.STRING(255), allowNull: false },
  title: { type: DataTypes.STRING(150), allowNull: false },
  message: { type: DataTypes.STRING(500), allowNull: false },
  target_path: { type: DataTypes.STRING(255), allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  read_at: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  tableName: "in_app_notification",
  timestamps: false,
  indexes: [
    { name: "uq_in_app_notification_recipient_event", unique: true, fields: ["recipient_subject", "event_key"] },
    { name: "ix_in_app_notification_recipient_created", fields: ["recipient_subject", "created_at"] },
  ],
});
