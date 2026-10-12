import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export type SecurityAccessActorType = "USER" | "ADMIN" | "SERVICE" | "SYSTEM";
export type SecurityAccessOutcome = "SUCCESS" | "FAILURE" | "UNKNOWN";

/**
 * Security-focused audit event, distinct from routine HTTP request logs and business AuditTrail.
 * Application code should only append rows; no update/delete API is provided.
 */
export class SecurityAccessLog extends Model {
  declare id: string;
  declare event_key: string;
  declare occurred_at: Date;
  declare actor_subject: string | null;
  declare actor_type: SecurityAccessActorType;
  declare active_role: string | null;
  declare event_type: string;
  declare object_type: string | null;
  declare object_id: string | null;
  declare ip_address: string | null;
  declare source_system: string;
  declare outcome: SecurityAccessOutcome;
  declare request_id: string | null;
  declare details: string | null;
  declare received_at: Date;
}

SecurityAccessLog.init({
  id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  event_key: { type: DataTypes.STRING(128), allowNull: false, unique: "uq_security_access_log_event_key" },
  occurred_at: { type: DataTypes.DATE, allowNull: false },
  actor_subject: { type: DataTypes.STRING(255), allowNull: true },
  actor_type: { type: DataTypes.STRING(30), allowNull: false },
  active_role: { type: DataTypes.STRING(50), allowNull: true },
  event_type: { type: DataTypes.STRING(100), allowNull: false },
  object_type: { type: DataTypes.STRING(100), allowNull: true },
  object_id: { type: DataTypes.STRING(255), allowNull: true },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  source_system: { type: DataTypes.STRING(50), allowNull: false },
  outcome: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "UNKNOWN" },
  request_id: { type: DataTypes.STRING(100), allowNull: true },
  details: { type: DataTypes.TEXT("long"), allowNull: true },
  received_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  tableName: "security_access_log",
  timestamps: false,
  indexes: [
    { name: "ix_security_access_log_occurred_at", fields: ["occurred_at", "id"] },
    { name: "ix_security_access_log_actor_occurred", fields: ["actor_subject", "occurred_at"] },
    { name: "ix_security_access_log_type_occurred", fields: ["event_type", "occurred_at"] },
    { name: "ix_security_access_log_object_occurred", fields: ["object_type", "object_id", "occurred_at"] },
  ],
});
