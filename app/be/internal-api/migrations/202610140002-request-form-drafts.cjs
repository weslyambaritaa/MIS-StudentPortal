"use strict";

const roles = ["student", "pic", "trainer", "sales", "admin", "finance", "management"];
const matrixIds = roles.map((_, index) => `62141400-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.sequelize.query("ALTER TABLE [dbo].[request_form] DROP CONSTRAINT [ck_request_form_training_type]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[request_form] DROP CONSTRAINT [ck_request_form_number_student]", { transaction });
      for (const column of ["training_title", "request_date", "training_type", "number_student"]) {
        await qi.changeColumn("request_form", column, { type: column === "request_date" ? S.DATEONLY : column === "number_student" ? S.INTEGER : column === "training_type" ? S.STRING(20) : S.STRING(255), allowNull: true }, { transaction });
      }
      await qi.addColumn("request_form", "account_id", { type: S.UUID, allowNull: true, references: { model: "account", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" }, { transaction });
      await qi.addColumn("request_form", "pic_profile_id", { type: S.UUID, allowNull: true, references: { model: "pic_profile", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" }, { transaction });
      await qi.addColumn("request_form", "status", { type: S.STRING(20), allowNull: false, defaultValue: "DRAFT" }, { transaction });
      await qi.addColumn("request_form", "po_reference", { type: S.STRING(150), allowNull: true }, { transaction });
      await qi.addColumn("request_form", "review_note", { type: S.TEXT, allowNull: true }, { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[request_form] ADD CONSTRAINT [ck_request_form_status] CHECK ([status] IN ('DRAFT','WAITING','REVISION'))", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[request_form] ADD CONSTRAINT [ck_request_form_training_type] CHECK ([training_type] IS NULL OR [training_type] IN ('PUBLIC','PRIVATE','INHOUSE','ONLINE'))", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[request_form] ADD CONSTRAINT [ck_request_form_number_student] CHECK ([number_student] IS NULL OR [number_student] > 0)", { transaction });
      await qi.addIndex("request_form", ["created_by_subject", "status", "created_at"], { name: "ix_request_form_sales_status_created", transaction });

      await qi.createTable("request_form_course", {
        id: { type: S.UUID, primaryKey: true, allowNull: false },
        request_form_id: { type: S.UUID, allowNull: false, references: { model: "request_form", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
        course_id: { type: S.UUID, allowNull: false, references: { model: "course", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        delivery_type: { type: S.STRING(20), allowNull: false },
        service_type: { type: S.STRING(20), allowNull: false, defaultValue: "STANDARD" },
        amount_student: { type: S.INTEGER, allowNull: false },
        language: { type: S.STRING(50), allowNull: false, defaultValue: "Indonesia" },
        room_rental: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        room_pc: { type: S.STRING(10), allowNull: true },
        room_services: { type: S.TEXT, allowNull: false, defaultValue: "[]" },
        special_instruction: { type: S.TEXT, allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      }, { transaction });
      await qi.addConstraint("request_form_course", { name: "uq_request_form_course", type: "unique", fields: ["request_form_id", "course_id"], transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[request_form_course] ADD CONSTRAINT [ck_request_form_course_delivery_type] CHECK ([delivery_type] IN ('PUBLIC','PRIVATE','INHOUSE','ONLINE')), CONSTRAINT [ck_request_form_course_service_type] CHECK ([service_type] IN ('STANDARD','CUSTOMIZED','CEO')), CONSTRAINT [ck_request_form_course_amount] CHECK ([amount_student] > 0), CONSTRAINT [ck_request_form_course_room_pc] CHECK ([room_pc] IS NULL OR [room_pc] IN ('WITH','WITHOUT'))", { transaction });
      await qi.addIndex("request_form_course", ["course_id"], { name: "ix_request_form_course_course", transaction });

      await qi.createTable("request_form_session", {
        id: { type: S.UUID, primaryKey: true, allowNull: false },
        request_form_course_id: { type: S.UUID, allowNull: false, references: { model: "request_form_course", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
        requested_date: { type: S.DATEONLY, allowNull: false },
        start_time: { type: S.TIME, allowNull: false },
        end_time: { type: S.TIME, allowNull: false },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      }, { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[request_form_session] ADD CONSTRAINT [ck_request_form_session_time] CHECK ([end_time] > [start_time])", { transaction });
      await qi.addIndex("request_form_session", ["request_form_course_id", "requested_date", "start_time"], { name: "ix_request_form_session_schedule", transaction });

      await qi.createTable("request_form_attachment", {
        id: { type: S.UUID, primaryKey: true, allowNull: false },
        request_form_id: { type: S.UUID, allowNull: false, references: { model: "request_form", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
        file_name: { type: S.STRING(255), allowNull: false },
        file_size: { type: S.INTEGER, allowNull: false },
        file_format: { type: S.STRING(10), allowNull: false },
        cloudinary_public_id: { type: S.STRING(255), allowNull: false },
        cloudinary_asset_id: { type: S.STRING(255), allowNull: false },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      }, { transaction });
      await qi.addIndex("request_form_attachment", ["request_form_id"], { name: "ix_request_form_attachment_form", transaction });

      await qi.bulkInsert("role_access_matrix", roles.map((role, index) => ({
        id: matrixIds[index], role, resource_group: "REQUEST_FORM",
        can_view: role === "sales" || role === "admin",
        can_create: role === "sales",
        can_edit: role === "sales" || role === "admin",
        can_delete: role === "sales",
        created_at: new Date(), updated_at: new Date(),
      })), { transaction });
    });
  },

  async down(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.bulkDelete("role_access_matrix", { id: matrixIds }, { transaction });
      await qi.dropTable("request_form_attachment", { transaction });
      await qi.dropTable("request_form_session", { transaction });
      await qi.dropTable("request_form_course", { transaction });
      await qi.removeIndex("request_form", "ix_request_form_sales_status_created", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[request_form] DROP CONSTRAINT [ck_request_form_status], [ck_request_form_training_type], [ck_request_form_number_student]", { transaction });
      for (const column of ["review_note", "po_reference", "status", "pic_profile_id", "account_id"]) await qi.removeColumn("request_form", column, { transaction });
      await qi.changeColumn("request_form", "training_title", { type: S.STRING(255), allowNull: false }, { transaction });
      await qi.changeColumn("request_form", "request_date", { type: S.DATEONLY, allowNull: false }, { transaction });
      await qi.changeColumn("request_form", "training_type", { type: S.STRING(20), allowNull: false }, { transaction });
      await qi.changeColumn("request_form", "number_student", { type: S.INTEGER, allowNull: false }, { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[request_form] ADD CONSTRAINT [ck_request_form_training_type] CHECK ([training_type] IN ('PUBLIC','PRIVATE'))", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[request_form] ADD CONSTRAINT [ck_request_form_number_student] CHECK ([number_student] > 0)", { transaction });
    });
  },
};
