import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export class KeycloakEventSyncCheckpoint extends Model {
  declare source_system: string;
  declare last_seen_at: Date;
  declare updated_at: Date;
}

KeycloakEventSyncCheckpoint.init({
  source_system: { type: DataTypes.STRING(50), allowNull: false, primaryKey: true },
  last_seen_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { sequelize, tableName: "keycloak_event_sync_checkpoint", timestamps: false });
