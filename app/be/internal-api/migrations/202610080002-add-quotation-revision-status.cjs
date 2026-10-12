"use strict";

module.exports = {
  async up(qi) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.sequelize.query(
        "ALTER TABLE [dbo].[quotation] DROP CONSTRAINT [ck_quotation_status]",
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE [dbo].[quotation] ADD CONSTRAINT [ck_quotation_status] CHECK ([status] IN ('DRAFT','SENT','WAITING','SEND_FAILED','APPROVED','CANCELLED','REVISION','REJECTED','EXPIRED'))",
        { transaction },
      );
    });
  },

  async down(qi) {
    await qi.sequelize.transaction(async (transaction) => {
      const rows = await qi.sequelize.query(
        "SELECT COUNT_BIG(1) AS [total] FROM [dbo].[quotation] WHERE [status]='REVISION'",
        { transaction },
      );
      if (Number(rows[0]?.[0]?.total ?? 0) > 0) {
        throw new Error("Cannot remove Revision status while quotations still use it");
      }
      await qi.sequelize.query(
        "ALTER TABLE [dbo].[quotation] DROP CONSTRAINT [ck_quotation_status]",
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE [dbo].[quotation] ADD CONSTRAINT [ck_quotation_status] CHECK ([status] IN ('DRAFT','SENT','WAITING','SEND_FAILED','APPROVED','CANCELLED','REJECTED','EXPIRED'))",
        { transaction },
      );
    });
  },
};
