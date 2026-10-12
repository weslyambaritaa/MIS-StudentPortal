"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("keycloak_event_sync_checkpoint", {
      source_system: { type: Sequelize.STRING(50), allowNull: false, primaryKey: true },
      last_seen_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("GETUTCDATE()") },
    });
  },
  async down() {
    throw new Error("Refusing to drop Keycloak event sync checkpoints; doing so can cause gaps or duplicate imports.");
  },
};
