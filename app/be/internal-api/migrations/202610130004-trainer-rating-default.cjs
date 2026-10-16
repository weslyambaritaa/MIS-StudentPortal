"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "UPDATE [dbo].[trainer_profile] SET [rating] = 0 WHERE [rating] IS NULL",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[trainer_profile] ALTER COLUMN [rating] DECIMAL(3,2) NOT NULL",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[trainer_profile] ADD CONSTRAINT [df_trainer_profile_rating] DEFAULT (0) FOR [rating]",
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[trainer_profile] DROP CONSTRAINT [df_trainer_profile_rating]",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[trainer_profile] ALTER COLUMN [rating] DECIMAL(3,2) NULL",
        { transaction },
      );
    });
  },
};
