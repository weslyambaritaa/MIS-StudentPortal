"use strict";

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.addColumn("request_form", "request_form_number", { type: S.STRING(20), allowNull: true }, { transaction });
      await qi.sequelize.query(`
        WITH numbered AS (
          SELECT id, EXTRACT(YEAR FROM created_at)::INTEGER AS number_year,
            ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM created_at) ORDER BY created_at, id) AS sequence_number
          FROM request_form
        )
        UPDATE request_form AS rf SET request_form_number = 'RF-' || n.number_year::TEXT || '-' || LPAD(n.sequence_number::TEXT, 4, '0')
        FROM numbered n WHERE n.id = rf.id;
      `, { transaction });
      await qi.changeColumn("request_form", "request_form_number", { type: S.STRING(20), allowNull: false }, { transaction });
      await qi.addIndex("request_form", ["request_form_number"], { name: "uq_request_form_number", unique: true, transaction });

      await qi.createTable("request_form_number_sequence", {
        number_year: { type: S.INTEGER, primaryKey: true, allowNull: false },
        last_number: { type: S.INTEGER, allowNull: false },
      }, { transaction });
      await qi.sequelize.query(`
        INSERT INTO request_form_number_sequence (number_year, last_number)
        SELECT EXTRACT(YEAR FROM created_at)::INTEGER, COUNT(*)::INTEGER FROM request_form
        GROUP BY EXTRACT(YEAR FROM created_at)::INTEGER;
      `, { transaction });

      // Avoid a second cascading update path through Training -> Request Form -> PIC.
      await qi.addColumn("training", "pic_profile_id", { type: S.UUID, allowNull: true, references: { model: "pic_profile", key: "id" }, onUpdate: "NO ACTION", onDelete: "NO ACTION" }, { transaction });
      await qi.addColumn("training", "expected_students", { type: S.INTEGER, allowNull: true }, { transaction });
      await qi.sequelize.query(`
        UPDATE training AS t SET pic_profile_id = rf.pic_profile_id, expected_students = course_totals.student_count
        FROM request_form rf
        LEFT JOIN LATERAL (
          SELECT SUM(amount_student) AS student_count
          FROM request_form_course
          WHERE request_form_id = rf.id
        ) course_totals ON TRUE
        WHERE rf.id = t.request_form_id;
      `, { transaction });
      await qi.sequelize.query("ALTER TABLE training ADD CONSTRAINT ck_training_expected_students CHECK (expected_students IS NULL OR expected_students > 0)", { transaction });
      await qi.addIndex("training", ["request_form_id"], { name: "uq_training_request_form", unique: true, transaction });
    });
  },

  async down(qi) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.removeIndex("training", "uq_training_request_form", { transaction });
      await qi.sequelize.query("ALTER TABLE training DROP CONSTRAINT ck_training_expected_students", { transaction });
      await qi.removeColumn("training", "expected_students", { transaction });
      await qi.removeColumn("training", "pic_profile_id", { transaction });
      await qi.dropTable("request_form_number_sequence", { transaction });
      await qi.removeIndex("request_form", "uq_request_form_number", { transaction });
      await qi.removeColumn("request_form", "request_form_number", { transaction });
    });
  },
};
