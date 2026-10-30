import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { Room } from "./en03-domain.models";

export type RoomReservationReason = "MEETING" | "EVENTS" | "WORKSHOP" | "OTHERS";

export class RoomReservation extends Model {
  declare id: string;
  declare room_id: string;
  declare booking_date: string;
  declare start_time: string;
  declare end_time: string;
  declare reason: RoomReservationReason;
  declare reason_detail: string | null;
  declare detail_booking: string;
  declare status: "BOOKED" | "CANCELLED";
  declare created_by_subject: string;
  declare created_at: Date;
  declare updated_at: Date;
}

RoomReservation.init({
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
  room_id: { type: DataTypes.UUID, allowNull: false },
  booking_date: { type: DataTypes.DATEONLY, allowNull: false },
  start_time: { type: DataTypes.TIME, allowNull: false },
  end_time: { type: DataTypes.TIME, allowNull: false },
  reason: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [["MEETING", "EVENTS", "WORKSHOP", "OTHERS"]] } },
  reason_detail: { type: DataTypes.STRING(255), allowNull: true },
  detail_booking: { type: DataTypes.STRING(1000), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "BOOKED", validate: { isIn: [["BOOKED", "CANCELLED"]] } },
  created_by_subject: { type: DataTypes.STRING(255), allowNull: false },
}, { sequelize, tableName: "room_reservation", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", indexes: [{ name: "ix_room_reservation_schedule", fields: ["room_id", "booking_date", "status"] }] });

Room.hasMany(RoomReservation, { foreignKey: "room_id", as: "roomReservations" });
RoomReservation.belongsTo(Room, { foreignKey: "room_id", as: "room" });
