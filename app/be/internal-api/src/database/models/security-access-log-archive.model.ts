import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

/** Read-only from the application API. Archive rows are written only by the retention worker. */
export class SecurityAccessLogArchive extends Model {
  declare id: string;
  declare event_key: string;
  declare occurred_at: Date;
  declare actor_subject: string | null;
  declare actor_type: string;
  declare active_role: string | null;
  declare event_type: string;
  declare object_type: string | null;
  declare object_id: string | null;
  declare ip_address: string | null;
  declare source_system: string;
  declare outcome: string;
  declare request_id: string | null;
  declare details: string | null;
  declare received_at: Date;
  declare archived_at: Date;
}

SecurityAccessLogArchive.init({
  id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  event_key: { type: DataTypes.STRING(128), allowNull: false, unique: "uq_security_access_log_archive_event_key" },
  occurred_at: { type: DataTypes.DATE, allowNull: false },
  actor_subject: { type: DataTypes.STRING(255), allowNull: true },
  actor_type: { type: DataTypes.STRING(30), allowNull: false },
  active_role: { type: DataTypes.STRING(50), allowNull: true },
  event_type: { type: DataTypes.STRING(100), allowNull: false },
  object_type: { type: DataTypes.STRING(100), allowNull: true },
  object_id: { type: DataTypes.STRING(255), allowNull: true },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  source_system: { type: DataTypes.STRING(50), allowNull: false },
  outcome: { type: DataTypes.STRING(20), allowNull: false },
  request_id: { type: DataTypes.STRING(100), allowNull: true },
  details: { type: DataTypes.TEXT("long"), allowNull: true },
  received_at: { type: DataTypes.DATE, allowNull: false },
  archived_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  tableName: "security_access_log_archive",
  timestamps: false,
  indexes: [
    { name: "ix_security_access_log_archive_occurred_at", fields: ["occurred_at", "id"] },
    { name: "ix_security_access_log_archive_actor_occurred", fields: ["actor_subject", "occurred_at"] },
  ],
});
