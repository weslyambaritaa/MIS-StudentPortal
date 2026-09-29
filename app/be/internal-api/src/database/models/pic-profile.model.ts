import { DataTypes, Model } from "sequelize";

import { sequelize } from "../sequelize";

export class PicProfile extends Model {
  declare id: string;
  declare keycloak_subject: string;
  declare position: string;
  declare created_at: Date;
  declare updated_at: Date;
}

PicProfile.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    keycloak_subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: "uq_pic_profile_keycloak_subject",
    },
    position: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "pic_profile",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
