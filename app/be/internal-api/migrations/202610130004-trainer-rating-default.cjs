"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "UPDATE trainer_profile SET rating = 0 WHERE rating IS NULL",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE trainer_profile ALTER COLUMN rating SET NOT NULL",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE trainer_profile ALTER COLUMN rating SET DEFAULT 0",
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "ALTER TABLE trainer_profile ALTER COLUMN rating DROP DEFAULT",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE trainer_profile ALTER COLUMN rating DROP NOT NULL",
        { transaction },
      );
    });
  },
};
