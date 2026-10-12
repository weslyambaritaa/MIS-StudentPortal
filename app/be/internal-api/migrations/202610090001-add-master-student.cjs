"use strict";

const roles = ["student", "pic", "trainer", "sales", "admin", "finance", "management"];

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.createTable("student_master_profile", {
        id: { type: S.UUID, primaryKey: true, allowNull: false },
        keycloak_subject: { type: S.STRING(255), allowNull: false },
        student_id: { type: S.UUID, allowNull: true },
        account_id: { type: S.UUID, allowNull: false },
        name: { type: S.STRING(200), allowNull: false },
        email: { type: S.STRING(254), allowNull: false },
        company_role: { type: S.STRING(200), allowNull: true },
        portal_enabled: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
        first_login_at: { type: S.DATE, allowNull: true },
        last_login_at: { type: S.DATE, allowNull: true },
        activation_expires_at: { type: S.DATE, allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      }, { transaction });
      await qi.addConstraint("student_master_profile", { name: "fk_student_master_account", type: "foreign key", fields: ["account_id"], references: { table: "account", field: "id" }, onDelete: "NO ACTION", transaction });
      await qi.addIndex("student_master_profile", ["keycloak_subject"], { name: "uq_student_master_keycloak_subject", unique: true, transaction });
      await qi.addIndex("student_master_profile", ["student_id"], { name: "ix_student_master_student_id", transaction });
      await qi.addIndex("student_master_profile", ["email"], { name: "uq_student_master_email", unique: true, transaction });
      await qi.addIndex("student_master_profile", ["account_id", "name"], { name: "ix_student_master_account", transaction });

      await qi.sequelize.query("ALTER TABLE [dbo].[role_access_matrix] DROP CONSTRAINT [ck_role_access_matrix_resource_group]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[role_access_matrix] ADD CONSTRAINT [ck_role_access_matrix_resource_group] CHECK ([resource_group] IN ('ACCOUNT','PIC','STUDENT','INDUSTRY','COURSE','COURSE_CATEGORY','QUOTATION','REQUEST_FORM','TRAINING','TRAINING_SESSION','PARTICIPANT','ATTENDANCE','EVALUATION','CERTIFICATE','INVOICE','ROOM','ROOM_BOOKING','CLASS_MATERIAL','REMOTE_LAB'))", { transaction });
      await qi.bulkInsert("role_access_matrix", roles.map((role, index) => ({
        id: `61090000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        role,
        resource_group: "STUDENT",
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
      await qi.bulkDelete("role_access_matrix", { resource_group: "STUDENT" }, { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[role_access_matrix] DROP CONSTRAINT [ck_role_access_matrix_resource_group]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[role_access_matrix] ADD CONSTRAINT [ck_role_access_matrix_resource_group] CHECK ([resource_group] IN ('ACCOUNT','PIC','INDUSTRY','COURSE','COURSE_CATEGORY','QUOTATION','REQUEST_FORM','TRAINING','TRAINING_SESSION','PARTICIPANT','ATTENDANCE','EVALUATION','CERTIFICATE','INVOICE','ROOM','ROOM_BOOKING','CLASS_MATERIAL','REMOTE_LAB'))", { transaction });
      await qi.dropTable("student_master_profile", { transaction });
    });
  },
};
