"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.addColumn(
        "trainer_profile",
        "specialization",
        { type: Sequelize.STRING(255), allowNull: false },
        { transaction },
      );
      await queryInterface.addColumn(
        "pic_profile",
        "position",
        { type: Sequelize.STRING(255), allowNull: false },
        { transaction },
      );
      await queryInterface.addColumn(
        "account",
        "account_type",
        { type: Sequelize.STRING(20), allowNull: false },
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE account ADD CONSTRAINT ck_account_account_type CHECK (account_type IN ('CORPORATE', 'PERSONAL'))",
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeConstraint("account", "ck_account_account_type", { transaction });
      await queryInterface.removeColumn("account", "account_type", { transaction });
      await queryInterface.removeColumn("pic_profile", "position", { transaction });
      await queryInterface.removeColumn("trainer_profile", "specialization", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
