"use strict";

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT COUNT_BIG(1) AS null_rows
         FROM [dbo].[training]
         WHERE [course_id] IS NULL OR [request_form_id] IS NULL OR [training_type] IS NULL`,
        { transaction },
      );
      if (Number(rows[0].null_rows) > 0) {
        throw new Error("Cannot enforce required Training fields: existing rows contain NULL values.");
      }

      // SQL Server will not alter indexed/FK columns in place. Temporarily remove
      // those dependencies, then restore the same FK/index contract below.
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] DROP CONSTRAINT [fk_training_course_id], [fk_training_request_form_id], [ck_training_type]",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "DROP INDEX [ix_training_course_id] ON [dbo].[training]; DROP INDEX [ix_training_request_form_id] ON [dbo].[training]",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ALTER COLUMN [course_id] CHAR(36) NOT NULL",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ALTER COLUMN [request_form_id] CHAR(36) NOT NULL",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ALTER COLUMN [training_type] NVARCHAR(20) NOT NULL",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ADD CONSTRAINT [fk_training_course_id] FOREIGN KEY ([course_id]) REFERENCES [dbo].[course] ([id]) ON UPDATE CASCADE ON DELETE NO ACTION",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ADD CONSTRAINT [fk_training_request_form_id] FOREIGN KEY ([request_form_id]) REFERENCES [dbo].[request_form] ([id]) ON UPDATE CASCADE ON DELETE NO ACTION",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "CREATE INDEX [ix_training_course_id] ON [dbo].[training] ([course_id]); CREATE INDEX [ix_training_request_form_id] ON [dbo].[training] ([request_form_id])",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ADD CONSTRAINT [ck_training_type] CHECK ([training_type] IN ('PUBLIC','PRIVATE'))",
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Training nullability migration rollback failed:", rollbackError.message);
      }
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] DROP CONSTRAINT [fk_training_course_id], [fk_training_request_form_id], [ck_training_type]",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "DROP INDEX [ix_training_course_id] ON [dbo].[training]; DROP INDEX [ix_training_request_form_id] ON [dbo].[training]",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ALTER COLUMN [course_id] CHAR(36) NULL",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ALTER COLUMN [request_form_id] CHAR(36) NULL",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ALTER COLUMN [training_type] NVARCHAR(20) NULL",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ADD CONSTRAINT [fk_training_course_id] FOREIGN KEY ([course_id]) REFERENCES [dbo].[course] ([id]) ON UPDATE CASCADE ON DELETE NO ACTION",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ADD CONSTRAINT [fk_training_request_form_id] FOREIGN KEY ([request_form_id]) REFERENCES [dbo].[request_form] ([id]) ON UPDATE CASCADE ON DELETE NO ACTION",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "CREATE INDEX [ix_training_course_id] ON [dbo].[training] ([course_id]); CREATE INDEX [ix_training_request_form_id] ON [dbo].[training] ([request_form_id])",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[training] ADD CONSTRAINT [ck_training_type] CHECK ([training_type] IS NULL OR [training_type] IN ('PUBLIC','PRIVATE'))",
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
