"use strict";

module.exports = {
  async up(qi, S) {
    const transaction = await qi.sequelize.transaction();
    try {
      await qi.addColumn("course", "course_code", { type: S.STRING(50), allowNull: true }, { transaction });
      await qi.sequelize.query(
        "UPDATE course SET course_code = 'CRS-' || UPPER(RIGHT(REPLACE(id::text, '-', ''), 8)) WHERE course_code IS NULL",
        { transaction },
      );
      await qi.changeColumn("course", "course_code", { type: S.STRING(50), allowNull: false }, { transaction });
      await qi.addIndex("course", ["course_code"], { name: "uq_course_code", unique: true, transaction });

      await qi.addColumn("syllabus", "cloudinary_public_id", { type: S.STRING(255), allowNull: true }, { transaction });
      await qi.addColumn("training", "syllabus_id", {
        type: S.UUID,
        allowNull: true,
        references: { model: "syllabus", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "NO ACTION",
      }, { transaction });
      await qi.addIndex("training", ["syllabus_id"], { name: "ix_training_syllabus_id", transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(qi) {
    const transaction = await qi.sequelize.transaction();
    try {
      await qi.removeIndex("training", "ix_training_syllabus_id", { transaction });
      await qi.removeColumn("training", "syllabus_id", { transaction });
      await qi.removeColumn("syllabus", "cloudinary_public_id", { transaction });
      await qi.removeIndex("course", "uq_course_code", { transaction });
      await qi.removeColumn("course", "course_code", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
