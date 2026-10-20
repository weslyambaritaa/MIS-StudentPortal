"use strict";

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.addColumn("request_form", "request_form_number", { type: S.STRING(20), allowNull: true }, { transaction });
      await qi.sequelize.query(`
        ;WITH numbered AS (
          SELECT [id], YEAR([created_at]) AS [number_year],
            ROW_NUMBER() OVER (PARTITION BY YEAR([created_at]) ORDER BY [created_at], [id]) AS [sequence_number]
          FROM [dbo].[request_form]
        )
        UPDATE rf SET [request_form_number] = CONCAT('RF-', n.[number_year], '-', FORMAT(n.[sequence_number], '0000'))
        FROM [dbo].[request_form] rf JOIN numbered n ON n.[id] = rf.[id];
      `, { transaction });
      await qi.changeColumn("request_form", "request_form_number", { type: S.STRING(20), allowNull: false }, { transaction });
      await qi.addIndex("request_form", ["request_form_number"], { name: "uq_request_form_number", unique: true, transaction });

      await qi.createTable("request_form_number_sequence", {
        number_year: { type: S.INTEGER, primaryKey: true, allowNull: false },
        last_number: { type: S.INTEGER, allowNull: false },
      }, { transaction });
      await qi.sequelize.query(`
        INSERT INTO [dbo].[request_form_number_sequence] ([number_year], [last_number])
        SELECT YEAR([created_at]), COUNT_BIG(1) FROM [dbo].[request_form]
        GROUP BY YEAR([created_at]);
      `, { transaction });

      // Avoid a second cascading update path through Training -> Request Form -> PIC.
      await qi.addColumn("training", "pic_profile_id", { type: S.UUID, allowNull: true, references: { model: "pic_profile", key: "id" }, onUpdate: "NO ACTION", onDelete: "NO ACTION" }, { transaction });
      await qi.addColumn("training", "expected_students", { type: S.INTEGER, allowNull: true }, { transaction });
      await qi.sequelize.query(`
        UPDATE t SET [pic_profile_id] = rf.[pic_profile_id], [expected_students] = course_totals.[student_count]
        FROM [dbo].[training] t
        JOIN [dbo].[request_form] rf ON rf.[id] = t.[request_form_id]
        OUTER APPLY (
          SELECT SUM([amount_student]) AS [student_count]
          FROM [dbo].[request_form_course]
          WHERE [request_form_id] = rf.[id]
        ) course_totals;
      `, { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[training] ADD CONSTRAINT [ck_training_expected_students] CHECK ([expected_students] IS NULL OR [expected_students] > 0)", { transaction });
      await qi.addIndex("training", ["request_form_id"], { name: "uq_training_request_form", unique: true, transaction });
    });
  },

  async down(qi) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.removeIndex("training", "uq_training_request_form", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[training] DROP CONSTRAINT [ck_training_expected_students]", { transaction });
      await qi.removeColumn("training", "expected_students", { transaction });
      await qi.removeColumn("training", "pic_profile_id", { transaction });
      await qi.dropTable("request_form_number_sequence", { transaction });
      await qi.removeIndex("request_form", "uq_request_form_number", { transaction });
      await qi.removeColumn("request_form", "request_form_number", { transaction });
    });
  },
};
