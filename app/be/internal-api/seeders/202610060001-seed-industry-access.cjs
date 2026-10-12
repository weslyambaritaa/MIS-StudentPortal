"use strict";

const GRANTS = [
  { id: "62000000-0000-4000-8000-000000000001", role: "sales", resource_group: "INDUSTRY", can_view: true, can_create: true, can_edit: true, can_delete: true },
  { id: "62000000-0000-4000-8000-000000000002", role: "admin", resource_group: "INDUSTRY", can_view: true, can_create: false, can_edit: false, can_delete: false },
  { id: "62000000-0000-4000-8000-000000000003", role: "finance", resource_group: "INDUSTRY", can_view: true, can_create: false, can_edit: false, can_delete: false },
  { id: "62000000-0000-4000-8000-000000000004", role: "management", resource_group: "INDUSTRY", can_view: true, can_create: false, can_edit: false, can_delete: false },
];

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const grant of GRANTS) {
        const [rows] = await queryInterface.sequelize.query(
          "SELECT TOP (1) [id] FROM [dbo].[role_access_matrix] WITH (UPDLOCK, HOLDLOCK) WHERE [role] = :role AND [resource_group] = :resource_group",
          { replacements: { role: grant.role, resource_group: grant.resource_group }, transaction },
        );
        if (rows.length) continue;
        const now = new Date();
        await queryInterface.bulkInsert("role_access_matrix", [{ ...grant, created_at: now, updated_at: now }], { transaction });
        await queryInterface.bulkInsert("audit_trail", [{
          id: `62000000-0000-4000-8000-${String(Number(grant.id.slice(-12)) + 100).padStart(12, "0")}`,
          actor_subject: "SYSTEM:ST10_SEED",
          action: "CREATE",
          object_type: "ROLE_ACCESS_MATRIX",
          object_id: grant.id,
          data_before: null,
          data_after: JSON.stringify(grant),
          created_at: now,
        }], { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
  async down() {
    throw new Error("Industry access grants are security configuration and are not automatically removed by seeder rollback");
  },
};
