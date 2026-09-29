"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("remote_lab", {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      // Logical reference to Internal SQL Server training.id. No cross-database FK.
      training_id: { type: Sequelize.UUID, allowNull: false, unique: "uq_remote_lab_training_id" },
      lab_url: { type: Sequelize.STRING(255), allowNull: false },
      start_period: { type: Sequelize.DATEONLY, allowNull: true },
      end_period: { type: Sequelize.DATEONLY, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("remote_lab");
  },
};
