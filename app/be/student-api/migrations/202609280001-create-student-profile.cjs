"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("student_profile", {
      student_id: {
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
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("student_profile", ["keycloak_subject"], {
      name: "uq_student_profile_keycloak_subject",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_profile");
  },
};
