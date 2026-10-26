"use strict";

const { randomUUID } = require("node:crypto");

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
        const now = new Date();
        const [rows] = await queryInterface.sequelize.query(
          `INSERT INTO role_access_matrix
             (id, role, resource_group, can_view, can_create, can_edit, can_delete, created_at, updated_at)
           VALUES (:id, :role, :resource_group, :can_view, :can_create, :can_edit, :can_delete, :now, :now)
           ON CONFLICT (role, resource_group) DO NOTHING
           RETURNING id`,
          { replacements: { ...grant, now }, transaction },
        );
        // Preserve existing policy, including explicit denials; audit only newly inserted grants.
        if (!rows.length) continue;
        await queryInterface.bulkInsert("audit_trail", [{
          id: randomUUID(),
          actor_subject: "SYSTEM:ST10_SEED",
          actor_name: "Industry access setup",
          actor_type: "SYSTEM",
          process_name: "industry-access-seed",
          source_service: "internal-api",
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
