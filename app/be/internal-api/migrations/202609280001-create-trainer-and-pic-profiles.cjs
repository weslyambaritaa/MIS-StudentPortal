"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("trainer_profile", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      keycloak_subject: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("GETUTCDATE()"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("GETUTCDATE()"),
      },
    });

    await queryInterface.addIndex("trainer_profile", ["keycloak_subject"], {
      name: "uq_trainer_profile_keycloak_subject",
      unique: true,
    });

    await queryInterface.createTable("pic_profile", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      keycloak_subject: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("GETUTCDATE()"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("GETUTCDATE()"),
      },
    });

    await queryInterface.addIndex("pic_profile", ["keycloak_subject"], {
      name: "uq_pic_profile_keycloak_subject",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("pic_profile");
    await queryInterface.dropTable("trainer_profile");
  },
};
