import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export class AuditTrailArchive extends Model {
  declare id: string;
  declare actor_subject: string | null;
  declare actor_name: string | null;
  declare actor_type: string;
  declare active_role: string | null;
  declare process_name: string | null;
  declare action: string;
  declare object_type: string;
  declare object_id: string | null;
  declare ip_address: string | null;
  declare source_service: string;
  declare data_before: string | null;
  declare data_after: string | null;
  declare created_at: Date;
  declare archived_at: Date;
}

AuditTrailArchive.init({
  id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  actor_subject: { type: DataTypes.STRING(255), allowNull: true },
  actor_name: { type: DataTypes.STRING(255), allowNull: true },
  actor_type: { type: DataTypes.STRING(20), allowNull: false },
  active_role: { type: DataTypes.STRING(50), allowNull: true },
  process_name: { type: DataTypes.STRING(128), allowNull: true },
  action: { type: DataTypes.STRING(50), allowNull: false },
  object_type: { type: DataTypes.STRING(50), allowNull: false },
  object_id: { type: DataTypes.STRING(100), allowNull: true },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  source_service: { type: DataTypes.STRING(50), allowNull: false },
  data_before: { type: DataTypes.TEXT("long"), allowNull: true },
  data_after: { type: DataTypes.TEXT("long"), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false },
  archived_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  tableName: "audit_trail_archive",
  timestamps: false,
  indexes: [
    { name: "ix_audit_trail_archive_created", fields: ["created_at", "id"] },
    { name: "ix_audit_trail_archive_role_created", fields: ["active_role", "created_at"] },
  ],
});
