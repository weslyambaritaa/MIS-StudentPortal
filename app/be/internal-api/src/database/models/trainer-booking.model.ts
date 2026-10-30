import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";

export class TrainerBooking extends Model {
  declare id: string;
  declare trainer_profile_id: string;
  declare booking_date: string;
  declare reason: string;
  declare reason_detail: string | null;
  declare detail_booking: string;
  declare status: "BOOKED" | "REPLACED_BY_TRAINING";
  declare created_by_subject: string;
  declare replaced_by_training_id: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

TrainerBooking.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    trainer_profile_id: { type: DataTypes.UUID, allowNull: false },
    booking_date: { type: DataTypes.DATEONLY, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    reason_detail: { type: DataTypes.TEXT, allowNull: true },
    detail_booking: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "BOOKED" },
    created_by_subject: { type: DataTypes.STRING(255), allowNull: false },
    replaced_by_training_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    tableName: "trainer_booking",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
