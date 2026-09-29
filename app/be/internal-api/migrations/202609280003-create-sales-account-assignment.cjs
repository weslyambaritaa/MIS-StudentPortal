"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("sales_account_assignment", {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      sales_subject: { type: Sequelize.STRING(255), allowNull: false },
      account_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "account", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "NO ACTION",
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("GETUTCDATE()"),
      },
      ended_at: { type: Sequelize.DATE, allowNull: true },
      assigned_by_subject: { type: Sequelize.STRING(255), allowNull: true },
      ended_by_subject: { type: Sequelize.STRING(255), allowNull: true },
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

    await queryInterface.addIndex("sales_account_assignment", ["account_id"], {
      name: "uq_sales_account_one_active_owner",
      unique: true,
      where: { ended_at: null },
    });
    await queryInterface.addIndex("sales_account_assignment", ["sales_subject", "ended_at"], {
      name: "ix_sales_assignment_subject_active",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("sales_account_assignment");
  },
};
