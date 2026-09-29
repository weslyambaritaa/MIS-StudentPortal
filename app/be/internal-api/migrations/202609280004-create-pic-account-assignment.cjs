"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pic_account_assignment", {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      pic_profile_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "pic_profile", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "NO ACTION",
      },
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

    await queryInterface.addIndex("pic_account_assignment", ["pic_profile_id"], {
      name: "uq_pic_one_active_account",
      unique: true,
      where: { ended_at: null },
    });
    await queryInterface.addIndex("pic_account_assignment", ["account_id", "ended_at"], {
      name: "ix_pic_account_assignment_account_active",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("pic_account_assignment");
  },
};
