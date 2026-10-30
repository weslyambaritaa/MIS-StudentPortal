"use strict";

module.exports = {
  async up(qi, S) {
    const transaction = await qi.sequelize.transaction();
    try {
      await qi.createTable("course_practice_file", {
        id: { type: S.UUID, primaryKey: true, allowNull: false },
        course_id: { type: S.UUID, allowNull: false, references: { model: "course", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
        file_name: { type: S.STRING(255), allowNull: false },
        file_url: { type: S.STRING(2048), allowNull: false },
        source_type: { type: S.STRING(10), allowNull: false },
        cloudinary_public_id: { type: S.STRING(255), allowNull: true },
        cloudinary_resource_type: { type: S.STRING(20), allowNull: true },
        cloudinary_format: { type: S.STRING(20), allowNull: true },
        created_at: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
        updated_at: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      }, { transaction });
      await qi.addIndex("course_practice_file", ["course_id"], { name: "ix_course_practice_file_course_id", transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(qi) {
    const transaction = await qi.sequelize.transaction();
    try {
      await qi.dropTable("course_practice_file", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
