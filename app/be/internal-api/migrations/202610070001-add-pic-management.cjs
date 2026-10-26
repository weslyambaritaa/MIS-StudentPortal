"use strict";

const ROLES = ["student", "pic", "trainer", "sales", "admin", "finance", "management"];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn("pic_profile", "name", { type: Sequelize.STRING(200), allowNull: true }, { transaction });
      await queryInterface.addColumn("pic_profile", "email", { type: Sequelize.STRING(254), allowNull: true }, { transaction });
      await queryInterface.addColumn("pic_profile", "status", { type: Sequelize.STRING(20), allowNull: false, defaultValue: "INACTIVE" }, { transaction });
      await queryInterface.addColumn("pic_profile", "activation_expires_at", { type: Sequelize.DATE, allowNull: true }, { transaction });
      await queryInterface.sequelize.query(
        "UPDATE pic_profile SET name = keycloak_subject, email = keycloak_subject WHERE name IS NULL OR email IS NULL",
        { transaction },
      );
      await queryInterface.changeColumn("pic_profile", "name", { type: Sequelize.STRING(200), allowNull: false }, { transaction });
      await queryInterface.changeColumn("pic_profile", "email", { type: Sequelize.STRING(254), allowNull: false }, { transaction });
      await queryInterface.addIndex("pic_profile", ["email"], { name: "uq_pic_profile_email", unique: true, transaction });
      await queryInterface.sequelize.query(
        "ALTER TABLE pic_profile ADD CONSTRAINT ck_pic_profile_status CHECK (status IN ('PENDING','ACTIVE','INACTIVE'))",
        { transaction },
      );

      await queryInterface.sequelize.query("ALTER TABLE role_access_matrix DROP CONSTRAINT ck_role_access_matrix_resource_group", { transaction });
      await queryInterface.sequelize.query(
        "ALTER TABLE role_access_matrix ADD CONSTRAINT ck_role_access_matrix_resource_group CHECK (resource_group IN ('ACCOUNT','PIC','INDUSTRY','COURSE','COURSE_CATEGORY','QUOTATION','REQUEST_FORM','TRAINING','TRAINING_SESSION','PARTICIPANT','ATTENDANCE','EVALUATION','CERTIFICATE','INVOICE','ROOM','ROOM_BOOKING','CLASS_MATERIAL','REMOTE_LAB'))",
        { transaction },
      );

      // This resource is explicitly granted only to Sales. Missing rows remain deny-by-default.
      const rows = ROLES.map((role, index) => ({
        id: `61070000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        role,
        resource_group: "PIC",
        can_view: role === "sales",
        can_create: role === "sales",
        can_edit: role === "sales",
        can_delete: role === "sales",
        created_at: new Date(),
        updated_at: new Date(),
      }));
      await queryInterface.bulkInsert("role_access_matrix", rows, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete("role_access_matrix", { resource_group: "PIC" }, { transaction });
      await queryInterface.sequelize.query("ALTER TABLE role_access_matrix DROP CONSTRAINT ck_role_access_matrix_resource_group", { transaction });
      await queryInterface.sequelize.query(
        "ALTER TABLE role_access_matrix ADD CONSTRAINT ck_role_access_matrix_resource_group CHECK (resource_group IN ('ACCOUNT','INDUSTRY','COURSE','COURSE_CATEGORY','QUOTATION','REQUEST_FORM','TRAINING','TRAINING_SESSION','PARTICIPANT','ATTENDANCE','EVALUATION','CERTIFICATE','INVOICE','ROOM','ROOM_BOOKING','CLASS_MATERIAL','REMOTE_LAB'))",
        { transaction },
      );
      await queryInterface.sequelize.query("ALTER TABLE pic_profile DROP CONSTRAINT ck_pic_profile_status", { transaction });
      await queryInterface.removeIndex("pic_profile", "uq_pic_profile_email", { transaction });
      await queryInterface.removeColumn("pic_profile", "activation_expires_at", { transaction });
      await queryInterface.removeColumn("pic_profile", "status", { transaction });
      await queryInterface.removeColumn("pic_profile", "email", { transaction });
      await queryInterface.removeColumn("pic_profile", "name", { transaction });
    });
  },
};
