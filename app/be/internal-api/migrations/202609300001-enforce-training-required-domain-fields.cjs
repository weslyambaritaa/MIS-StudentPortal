"use strict";

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const [rows] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS null_rows FROM training WHERE course_id IS NULL OR request_form_id IS NULL OR training_type IS NULL",
        { transaction },
      );
      if (Number(rows[0].null_rows) > 0) {
        throw new Error("Cannot enforce required Training fields: existing rows contain NULL values.");
      }

      await queryInterface.sequelize.query("ALTER TABLE training DROP CONSTRAINT ck_training_type", { transaction });
      await queryInterface.sequelize.query("ALTER TABLE training ALTER COLUMN course_id SET NOT NULL", { transaction });
      await queryInterface.sequelize.query("ALTER TABLE training ALTER COLUMN request_form_id SET NOT NULL", { transaction });
      await queryInterface.sequelize.query("ALTER TABLE training ALTER COLUMN training_type SET NOT NULL", { transaction });
      await queryInterface.sequelize.query("ALTER TABLE training ADD CONSTRAINT ck_training_type CHECK (training_type IN ('PUBLIC','PRIVATE'))", { transaction });

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
      await queryInterface.sequelize.query("ALTER TABLE training DROP CONSTRAINT ck_training_type", { transaction });
      await queryInterface.sequelize.query("ALTER TABLE training ALTER COLUMN course_id DROP NOT NULL", { transaction });
      await queryInterface.sequelize.query("ALTER TABLE training ALTER COLUMN request_form_id DROP NOT NULL", { transaction });
      await queryInterface.sequelize.query("ALTER TABLE training ALTER COLUMN training_type DROP NOT NULL", { transaction });
      await queryInterface.sequelize.query("ALTER TABLE training ADD CONSTRAINT ck_training_type CHECK (training_type IS NULL OR training_type IN ('PUBLIC','PRIVATE'))", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
