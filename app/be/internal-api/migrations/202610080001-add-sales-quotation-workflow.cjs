"use strict";

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.addColumn("quotation", "quotation_code", { type: S.STRING(30), allowNull: true }, { transaction });
      await qi.addColumn("quotation", "pic_profile_id", { type: S.UUID, allowNull: true }, { transaction });
      await qi.addColumn("quotation", "class_type", { type: S.STRING(20), allowNull: true }, { transaction });
      await qi.addColumn("quotation", "deleted_at", { type: S.DATE, allowNull: true }, { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[quotation] DROP CONSTRAINT [ck_quotation_status]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[quotation] ADD CONSTRAINT [ck_quotation_status] CHECK ([status] IN ('DRAFT','SENT','WAITING','SEND_FAILED','APPROVED','CANCELLED','REJECTED','EXPIRED'))", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[quotation_order] DROP CONSTRAINT [ck_quotation_order_class_type]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[quotation_order] ADD CONSTRAINT [ck_quotation_order_class_type] CHECK ([class_type] IN ('PUBLIC','PRIVATE','INHOUSE','ONLINE'))", { transaction });
      const [countRows] = await qi.sequelize.query("SELECT COUNT_BIG(1) AS [total] FROM [dbo].[quotation]", { transaction });
      const startAt = Number(countRows[0]?.total ?? 0) + 1;
      await qi.sequelize.query(`CREATE SEQUENCE [dbo].[quotation_code_seq] AS BIGINT START WITH ${startAt} INCREMENT BY 1`, { transaction });
      await qi.sequelize.query("CREATE UNIQUE INDEX [uq_quotation_code] ON [dbo].[quotation] ([quotation_code]) WHERE [quotation_code] IS NOT NULL", { transaction });
      await qi.addIndex("quotation", ["created_by_subject", "deleted_at"], { name: "ix_quotation_sales_deleted", transaction });
      await qi.createTable("quotation_document", {
        id: { type: S.UUID, primaryKey: true, allowNull: false }, quotation_id: { type: S.UUID, allowNull: false },
        version: { type: S.INTEGER, allowNull: false }, cloudinary_public_id: { type: S.STRING(255), allowNull: false },
        cloudinary_asset_id: { type: S.STRING(255), allowNull: false }, recipient_email: { type: S.STRING(254), allowNull: false },
        sent_at: { type: S.DATE, allowNull: false }, created_at: { type: S.DATE, allowNull: false }, updated_at: { type: S.DATE, allowNull: false },
      }, { transaction });
      await qi.addConstraint("quotation_document", { name: "fk_quotation_document_quotation", type: "foreign key", fields: ["quotation_id"], references: { table: "quotation", field: "id" }, onDelete: "NO ACTION", transaction });
      await qi.addConstraint("quotation_document", { name: "uq_quotation_document_version", type: "unique", fields: ["quotation_id", "version"], transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[role_access_matrix] DROP CONSTRAINT [ck_role_access_matrix_resource_group]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[role_access_matrix] ADD CONSTRAINT [ck_role_access_matrix_resource_group] CHECK ([resource_group] IN ('ACCOUNT','PIC','INDUSTRY','COURSE','COURSE_CATEGORY','QUOTATION','REQUEST_FORM','TRAINING','TRAINING_SESSION','PARTICIPANT','ATTENDANCE','EVALUATION','CERTIFICATE','INVOICE','ROOM','ROOM_BOOKING','CLASS_MATERIAL','REMOTE_LAB'))", { transaction });
      const roles = ["student", "pic", "trainer", "sales", "admin", "finance", "management"];
      await qi.bulkInsert("role_access_matrix", roles.map((role, i) => ({ id: `61080000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, role, resource_group: "QUOTATION", can_view: role === "sales", can_create: role === "sales", can_edit: role === "sales", can_delete: role === "sales", created_at: new Date(), updated_at: new Date() })), { transaction });
    });
  },
  async down(qi) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.bulkDelete("role_access_matrix", { resource_group: "QUOTATION" }, { transaction });
      await qi.dropTable("quotation_document", { transaction });
      await qi.removeIndex("quotation", "ix_quotation_sales_deleted", { transaction });
      await qi.sequelize.query("DROP INDEX [uq_quotation_code] ON [dbo].[quotation]", { transaction });
      await qi.sequelize.query("DROP SEQUENCE [dbo].[quotation_code_seq]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[quotation] DROP CONSTRAINT [ck_quotation_status]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[quotation] ADD CONSTRAINT [ck_quotation_status] CHECK ([status] IN ('DRAFT','SENT','APPROVED','REJECTED','EXPIRED'))", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[quotation_order] DROP CONSTRAINT [ck_quotation_order_class_type]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[quotation_order] ADD CONSTRAINT [ck_quotation_order_class_type] CHECK ([class_type] IN ('PUBLIC','PRIVATE'))", { transaction });
      await qi.removeColumn("quotation", "deleted_at", { transaction });
      await qi.removeColumn("quotation", "class_type", { transaction });
      await qi.removeColumn("quotation", "pic_profile_id", { transaction });
      await qi.removeColumn("quotation", "quotation_code", { transaction });
    });
  },
};
