"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("audit_outbox", {
      event_id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      payload: { type: Sequelize.JSONB, allowNull: false },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      next_attempt_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
    await queryInterface.addIndex("audit_outbox", ["next_attempt_at", "created_at"], { name: "ix_audit_outbox_delivery" });
  },

  async down() {
    throw new Error("Refusing to drop pending audit outbox events; preserve them before any manual rollback.");
  },
};
