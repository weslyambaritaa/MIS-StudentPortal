"use strict";

const roles = ["student", "pic", "trainer", "sales", "admin", "finance", "management"];
const matrixIds = roles.map((_, index) => `62131400-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert("role_access_matrix", roles.map((role, index) => ({
        id: matrixIds[index],
        role,
        resource_group: "COURSE",
        can_view: role === "admin",
        can_create: role === "admin",
        can_edit: role === "admin",
        can_delete: role === "admin",
        created_at: new Date(),
        updated_at: new Date(),
      })), { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("role_access_matrix", { id: matrixIds });
  },
};
