import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export class AuditOutbox extends Model {
  declare event_id: string;
  declare payload: Record<string, unknown>;
  declare attempts: number;
  declare next_attempt_at: Date;
  declare created_at: Date;
}

AuditOutbox.init({
  event_id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
  payload: { type: DataTypes.JSONB, allowNull: false },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  next_attempt_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  tableName: "audit_outbox",
  timestamps: false,
  indexes: [{ name: "ix_audit_outbox_delivery", fields: ["next_attempt_at", "created_at"] }],
});
