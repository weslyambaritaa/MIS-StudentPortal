"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("security_access_log", {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
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
        outcome: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "UNKNOWN" },
        request_id: { type: Sequelize.STRING(100), allowNull: true },
        details: { type: Sequelize.TEXT("long"), allowNull: true },
        received_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      }, { transaction });

      await queryInterface.addIndex("security_access_log", ["event_key"], {
        name: "uq_security_access_log_event_key", unique: true, transaction,
      });
      await queryInterface.addIndex("security_access_log", ["occurred_at", "id"], {
        name: "ix_security_access_log_occurred_at", transaction,
      });
      await queryInterface.addIndex("security_access_log", ["actor_subject", "occurred_at"], {
        name: "ix_security_access_log_actor_occurred", transaction,
      });
      await queryInterface.addIndex("security_access_log", ["event_type", "occurred_at"], {
        name: "ix_security_access_log_type_occurred", transaction,
      });
      await queryInterface.addIndex("security_access_log", ["object_type", "object_id", "occurred_at"], {
        name: "ix_security_access_log_object_occurred", transaction,
      });
    });
  },

  async down(queryInterface) {
    // A rollback must not erase audit evidence. Use a reviewed operational archive procedure instead.
    throw new Error("Refusing to drop security_access_log. Preserve data before any manual rollback.");
  },
};
