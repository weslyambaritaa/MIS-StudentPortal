"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("pic_profile", {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        keycloak_subject: { type: Sequelize.STRING(255), allowNull: false },
        name: { type: Sequelize.STRING(200), allowNull: false },
        email: { type: Sequelize.STRING(254), allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "PENDING" },
        activation_expires_at: { type: Sequelize.DATE, allowNull: true },
        position: { type: Sequelize.STRING(255), allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      }, { transaction });
      await queryInterface.addIndex("pic_profile", ["keycloak_subject"], { name: "uq_pic_profile_keycloak_subject", unique: true, transaction });
      await queryInterface.addIndex("pic_profile", ["email"], { name: "uq_pic_profile_email", unique: true, transaction });

      await queryInterface.createTable("pic_account_assignment", {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        pic_profile_id: { type: Sequelize.UUID, allowNull: false, references: { model: "pic_profile", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
        // Account remains owned by Internal API. This is intentionally not a cross-database FK.
        account_id: { type: Sequelize.UUID, allowNull: false },
        assigned_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        ended_at: { type: Sequelize.DATE, allowNull: true },
        assigned_by_subject: { type: Sequelize.STRING(255), allowNull: true },
        ended_by_subject: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      }, { transaction });
      await queryInterface.addIndex("pic_account_assignment", ["pic_profile_id"], { name: "uq_pic_one_active_account", unique: true, where: { ended_at: null }, transaction });
      await queryInterface.addIndex("pic_account_assignment", ["account_id", "ended_at"], { name: "ix_pic_account_assignment_account_active", transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("pic_account_assignment", { transaction });
      await queryInterface.dropTable("pic_profile", { transaction });
    });
  },
};
