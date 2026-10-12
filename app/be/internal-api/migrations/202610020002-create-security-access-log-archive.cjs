"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("security_access_log_archive", {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        event_key: { type: Sequelize.STRING(128), allowNull: false },
        occurred_at: { type: Sequelize.DATE, allowNull: false },
        actor_subject: { type: Sequelize.STRING(255), allowNull: true },
        actor_type: { type: Sequelize.STRING(30), allowNull: false },
        active_role: { type: Sequelize.STRING(50), allowNull: true },
        event_type: { type: Sequelize.STRING(100), allowNull: false },
        object_type: { type: Sequelize.STRING(100), allowNull: true },
        object_id: { type: Sequelize.STRING(255), allowNull: true },
        ip_address: { type: Sequelize.STRING(45), allowNull: true },
        source_system: { type: Sequelize.STRING(50), allowNull: false },
        outcome: { type: Sequelize.STRING(20), allowNull: false },
        request_id: { type: Sequelize.STRING(100), allowNull: true },
        details: { type: Sequelize.TEXT("long"), allowNull: true },
        received_at: { type: Sequelize.DATE, allowNull: false },
        archived_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("GETUTCDATE()") },
      }, { transaction });

      await queryInterface.addIndex("security_access_log_archive", ["event_key"], {
        name: "uq_security_access_log_archive_event_key", unique: true, transaction,
      });
      await queryInterface.addIndex("security_access_log_archive", ["occurred_at", "id"], {
        name: "ix_security_access_log_archive_occurred_at", transaction,
      });
      await queryInterface.addIndex("security_access_log_archive", ["actor_subject", "occurred_at"], {
        name: "ix_security_access_log_archive_actor_occurred", transaction,
      });
    });
  },

  async down() {
    throw new Error("Refusing to drop security_access_log_archive. Archived audit evidence must be preserved.");
  },
};
