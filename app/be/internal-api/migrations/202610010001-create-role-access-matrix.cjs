"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        "role_access_matrix",
        {
          id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
          role: { type: Sequelize.STRING(20), allowNull: false },
          resource_group: { type: Sequelize.STRING(50), allowNull: false },
          can_view: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          can_create: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          can_edit: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          can_delete: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
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
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[role_access_matrix] ADD CONSTRAINT [ck_role_access_matrix_business_role] CHECK ([role] IN ('student','pic','trainer','sales','admin','finance','management'))",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[role_access_matrix] ADD CONSTRAINT [ck_role_access_matrix_resource_group] CHECK ([resource_group] IN ('ACCOUNT','INDUSTRY','COURSE','COURSE_CATEGORY','QUOTATION','REQUEST_FORM','TRAINING','TRAINING_SESSION','PARTICIPANT','ATTENDANCE','EVALUATION','CERTIFICATE','INVOICE','ROOM','ROOM_BOOKING','CLASS_MATERIAL','REMOTE_LAB'))",
        { transaction },
      );
      await queryInterface.addIndex("role_access_matrix", ["role", "resource_group"], {
        name: "uq_role_access_matrix_role_resource",
        unique: true,
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("role_access_matrix");
  },
};
