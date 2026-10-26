"use strict";

const CATEGORY_ID = "c1260000-0000-4000-8000-000000000001";
const COURSE_ID = "c1260000-0000-4000-8000-000000000002";
const CATEGORY_NAME = "Data Analytics";
const COURSE_CODE = "CRS-DEMO-PBI-001";

function assertDevelopmentEnvironment() {
  if (!["development", "test"].includes(process.env.NODE_ENV || "development")) {
    throw new Error("Course sample data is restricted to development/test.");
  }
}

module.exports = {
  async up(qi) {
    assertDevelopmentEnvironment();
    await qi.sequelize.transaction(async (transaction) => {
      await qi.sequelize.query(
        `INSERT INTO course_category (id, category_code, name, created_at, updated_at)
         SELECT :id, 'CAT-' || LPAD(sequence.value, GREATEST(2, LENGTH(sequence.value)), '0'),
                :name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         FROM (SELECT nextval('course_category_code_seq')::text AS value
               WHERE NOT EXISTS (SELECT 1 FROM course_category WHERE name = :name)) sequence
         ON CONFLICT (id) DO NOTHING`,
        { replacements: { id: CATEGORY_ID, name: CATEGORY_NAME }, transaction },
      );

      // Reuse the category by name, including categories created through the UI.
      // One training day is 480 minutes, matching the Course API.
      await qi.sequelize.query(
        `INSERT INTO course
           (id, course_code, category_id, name, duration_minutes, level,
            module_url, status, created_at, updated_at)
         SELECT :id, :code, category.id, :name, 960, 'BEGINNER',
                NULL, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         FROM course_category category WHERE category.name = :categoryName
         ORDER BY category.created_at, category.id LIMIT 1
         ON CONFLICT (course_code) DO NOTHING`,
        {
          replacements: {
            id: COURSE_ID,
            code: COURSE_CODE,
            name: "Power BI Fundamental",
            categoryName: CATEGORY_NAME,
          },
          transaction,
        },
      );
    });
  },

  async down(qi) {
    assertDevelopmentEnvironment();
    await qi.sequelize.transaction(async (transaction) => {
      // Never delete a pre-existing course that merely has the same code.
      // Foreign keys prevent removal when the sample course is already in use.
      await qi.sequelize.query(
        "DELETE FROM course WHERE id = :id AND course_code = :code",
        { replacements: { id: COURSE_ID, code: COURSE_CODE }, transaction },
      );
      await qi.sequelize.query(
        `DELETE FROM course_category
         WHERE id = :id AND name = :name
           AND NOT EXISTS (SELECT 1 FROM course WHERE category_id = :id)`,
        { replacements: { id: CATEGORY_ID, name: CATEGORY_NAME }, transaction },
      );
    });
  },
};
