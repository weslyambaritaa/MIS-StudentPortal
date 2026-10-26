"use strict";

const roles = ["student", "pic", "trainer", "sales", "admin", "finance", "management"];

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.addColumn("course_category", "category_code", { type: S.STRING(20), allowNull: true }, { transaction });
      await qi.sequelize.query(`
        WITH numbered AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS sequence_number
          FROM course_category
        )
        UPDATE course_category AS category
           SET category_code = 'CAT-' || LPAD(numbered.sequence_number::text, 2, '0')
          FROM numbered
         WHERE numbered.id = category.id
      `, { transaction });
      await qi.changeColumn("course_category", "category_code", { type: S.STRING(20), allowNull: false }, { transaction });
      await qi.sequelize.query("DROP INDEX uq_course_category_name", { transaction });
      await qi.sequelize.query("CREATE UNIQUE INDEX uq_course_category_code ON course_category (category_code)", { transaction });
      const [rows] = await qi.sequelize.query("SELECT COALESCE(MAX(NULLIF(SUBSTRING(category_code FROM 5), '')::BIGINT), 0) + 1 AS next_value FROM course_category", { transaction });
      const nextValue = Math.max(1, Number(rows[0]?.next_value ?? 1));
      await qi.sequelize.query(`CREATE SEQUENCE course_category_code_seq START WITH ${nextValue} INCREMENT BY 1`, { transaction });
      await qi.bulkInsert("role_access_matrix", roles.map((role, index) => ({
        id: `62130000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        role,
        resource_group: "COURSE_CATEGORY",
        can_view: role === "admin",
        can_create: role === "admin",
        can_edit: role === "admin",
        can_delete: role === "admin",
        created_at: new Date(),
        updated_at: new Date(),
      })), { transaction });
    });
  },

  async down(qi) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.bulkDelete("role_access_matrix", { id: roles.map((_, index) => `62130000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`) }, { transaction });
      await qi.sequelize.query("DROP SEQUENCE course_category_code_seq", { transaction });
      await qi.sequelize.query("DROP INDEX uq_course_category_code", { transaction });
      await qi.sequelize.query("CREATE UNIQUE INDEX uq_course_category_name ON course_category (name)", { transaction });
      await qi.removeColumn("course_category", "category_code", { transaction });
    });
  },
};
