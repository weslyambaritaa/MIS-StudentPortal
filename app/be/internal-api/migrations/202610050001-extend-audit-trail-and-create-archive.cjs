"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn("audit_trail", "actor_name", { type: Sequelize.STRING(255), allowNull: true }, { transaction });
      await queryInterface.addColumn("audit_trail", "actor_type", { type: Sequelize.STRING(20), allowNull: false, defaultValue: "USER" }, { transaction });
      await queryInterface.addColumn("audit_trail", "active_role", { type: Sequelize.STRING(50), allowNull: true }, { transaction });
      await queryInterface.addColumn("audit_trail", "process_name", { type: Sequelize.STRING(128), allowNull: true }, { transaction });
      await queryInterface.addColumn("audit_trail", "ip_address", { type: Sequelize.STRING(45), allowNull: true }, { transaction });
      await queryInterface.addColumn("audit_trail", "source_service", { type: Sequelize.STRING(50), allowNull: false, defaultValue: "internal-api" }, { transaction });
      await queryInterface.addIndex("audit_trail", ["active_role", "created_at"], { name: "ix_audit_trail_role_created", transaction });

      await queryInterface.createTable("audit_trail_archive", {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        actor_subject: { type: Sequelize.STRING(255), allowNull: true },
        actor_name: { type: Sequelize.STRING(255), allowNull: true },
        actor_type: { type: Sequelize.STRING(20), allowNull: false },
        active_role: { type: Sequelize.STRING(50), allowNull: true },
        process_name: { type: Sequelize.STRING(128), allowNull: true },
        action: { type: Sequelize.STRING(50), allowNull: false },
        object_type: { type: Sequelize.STRING(50), allowNull: false },
        object_id: { type: Sequelize.STRING(100), allowNull: true },
        ip_address: { type: Sequelize.STRING(45), allowNull: true },
        source_service: { type: Sequelize.STRING(50), allowNull: false },
        data_before: { type: Sequelize.TEXT("long"), allowNull: true },
        data_after: { type: Sequelize.TEXT("long"), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        archived_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      }, { transaction });
      await queryInterface.addIndex("audit_trail_archive", ["created_at", "id"], { name: "ix_audit_trail_archive_created", transaction });
      await queryInterface.addIndex("audit_trail_archive", ["active_role", "created_at"], { name: "ix_audit_trail_archive_role_created", transaction });
    });
  },

  async down() {
    throw new Error("Refusing to remove Audit Trail schema; preserve audit evidence and use a reviewed recovery procedure.");
  },
};
