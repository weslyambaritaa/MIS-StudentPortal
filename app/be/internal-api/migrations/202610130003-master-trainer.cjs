"use strict";

const roles = ["student", "pic", "trainer", "sales", "admin", "finance", "management"];
const matrixIds = roles.map((_, index) => `62130300-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.sequelize.query("ALTER TABLE [dbo].[role_access_matrix] DROP CONSTRAINT [ck_role_access_matrix_resource_group]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[role_access_matrix] ADD CONSTRAINT [ck_role_access_matrix_resource_group] CHECK ([resource_group] IN ('ACCOUNT','PIC','STUDENT','TRAINER','INDUSTRY','COURSE','COURSE_CATEGORY','QUOTATION','REQUEST_FORM','TRAINING','TRAINING_SESSION','PARTICIPANT','ATTENDANCE','EVALUATION','CERTIFICATE','INVOICE','ROOM','ROOM_BOOKING','CLASS_MATERIAL','REMOTE_LAB'))", { transaction });
      await qi.bulkInsert("role_access_matrix", roles.map((role, index) => ({ id: matrixIds[index], role, resource_group: "TRAINER", can_view: role === "admin", can_create: role === "admin", can_edit: role === "admin", can_delete: role === "admin", created_at: new Date(), updated_at: new Date() })), { transaction });
      await qi.addColumn("trainer_profile", "trainer_code", { type: S.STRING(50), allowNull: true }, { transaction });
      await qi.addColumn("trainer_profile", "name", { type: S.STRING(200), allowNull: true }, { transaction });
      await qi.addColumn("trainer_profile", "email", { type: S.STRING(254), allowNull: true }, { transaction });
      await qi.addColumn("trainer_profile", "rating", { type: S.DECIMAL(3, 2), allowNull: true }, { transaction });
      await qi.addColumn("trainer_profile", "status", { type: S.STRING(20), allowNull: false, defaultValue: "ACTIVE" }, { transaction });
      await qi.addColumn("trainer_profile", "first_login_at", { type: S.DATE, allowNull: true }, { transaction });
      await qi.addColumn("trainer_profile", "activation_expires_at", { type: S.DATE, allowNull: true }, { transaction });
      await qi.sequelize.query("CREATE UNIQUE INDEX [uq_trainer_profile_code] ON [dbo].[trainer_profile] ([trainer_code]) WHERE [trainer_code] IS NOT NULL", { transaction });
      await qi.sequelize.query("CREATE UNIQUE INDEX [uq_trainer_profile_email] ON [dbo].[trainer_profile] ([email]) WHERE [email] IS NOT NULL", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[trainer_profile] ADD CONSTRAINT [ck_trainer_profile_status] CHECK ([status] IN ('PENDING','ACTIVE','INACTIVE'))", { transaction });

      await qi.createTable("trainer_certification", {
        id: { type: S.UUID, primaryKey: true, allowNull: false },
        trainer_profile_id: { type: S.UUID, allowNull: false },
        name: { type: S.STRING(200), allowNull: false },
        expires_at: { type: S.DATEONLY, allowNull: false },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      }, { transaction });
      await qi.addConstraint("trainer_certification", { name: "fk_trainer_certification_profile", type: "foreign key", fields: ["trainer_profile_id"], references: { table: "trainer_profile", field: "id" }, onDelete: "CASCADE", transaction });
      await qi.addIndex("trainer_certification", ["trainer_profile_id", "expires_at"], { name: "ix_trainer_certification_profile_expiry", transaction });
    });
  },

  async down(qi) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.bulkDelete("role_access_matrix", { id: matrixIds }, { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[role_access_matrix] DROP CONSTRAINT [ck_role_access_matrix_resource_group]", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[role_access_matrix] ADD CONSTRAINT [ck_role_access_matrix_resource_group] CHECK ([resource_group] IN ('ACCOUNT','PIC','STUDENT','INDUSTRY','COURSE','COURSE_CATEGORY','QUOTATION','REQUEST_FORM','TRAINING','TRAINING_SESSION','PARTICIPANT','ATTENDANCE','EVALUATION','CERTIFICATE','INVOICE','ROOM','ROOM_BOOKING','CLASS_MATERIAL','REMOTE_LAB'))", { transaction });
      await qi.dropTable("trainer_certification", { transaction });
      await qi.sequelize.query("ALTER TABLE [dbo].[trainer_profile] DROP CONSTRAINT [ck_trainer_profile_status]", { transaction });
      await qi.sequelize.query("DROP INDEX [uq_trainer_profile_code] ON [dbo].[trainer_profile]", { transaction });
      await qi.sequelize.query("DROP INDEX [uq_trainer_profile_email] ON [dbo].[trainer_profile]", { transaction });
      for (const column of ["activation_expires_at", "first_login_at", "status", "rating", "email", "name", "trainer_code"]) {
        await qi.removeColumn("trainer_profile", column, { transaction });
      }
    });
  },
};
