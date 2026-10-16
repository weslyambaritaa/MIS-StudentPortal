"use strict";

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.addColumn("request_form", "form_type", {
        type: S.STRING(20),
        allowNull: false,
        defaultValue: "REQUEST",
      }, { transaction });

      await qi.sequelize.query(
        `UPDATE rf SET [form_type] = CASE
          WHEN q.[class_type] IN ('PUBLIC','ONLINE_PUBLIC') THEN 'REGISTRATION'
          WHEN EXISTS (
            SELECT 1 FROM [dbo].[request_form_course] rfc
            WHERE rfc.[request_form_id] = rf.[id] AND rfc.[delivery_type] = 'PUBLIC'
          ) THEN 'REGISTRATION'
          ELSE 'REQUEST'
        END
        FROM [dbo].[request_form] rf
        LEFT JOIN [dbo].[quotation] q ON q.[id] = rf.[quotation_id]`,
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE [dbo].[request_form] ADD CONSTRAINT [ck_request_form_form_type] CHECK ([form_type] IN ('REQUEST','REGISTRATION'))",
        { transaction },
      );
      await qi.addIndex("request_form", ["created_by_subject", "form_type", "status"], {
        name: "ix_request_form_sales_type_status",
        transaction,
      });
    });
  },

  async down(qi) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.removeIndex("request_form", "ix_request_form_sales_type_status", { transaction });
      await qi.sequelize.query(
        "ALTER TABLE [dbo].[request_form] DROP CONSTRAINT [ck_request_form_form_type]",
        { transaction },
      );
      await qi.removeColumn("request_form", "form_type", { transaction });
    });
  },
};
