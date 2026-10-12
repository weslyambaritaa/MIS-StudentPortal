"use strict";

const MATRIX_ID = "61000000-0000-4000-8000-000000000001";
const SEED_AUDIT_ID = "61000000-0000-4000-8000-000000000002";
const ROLLBACK_AUDIT_ID = "61000000-0000-4000-8000-000000000003";
const KEY = { role: "sales", resource_group: "ACCOUNT" };
const ACCESS = {
  id: MATRIX_ID,
  ...KEY,
  can_view: true,
  can_create: false,
  can_edit: false,
  can_delete: false,
};

async function findSeededRow(qi, transaction) {
  const [rows] = await qi.sequelize.query(
    "SELECT TOP (1) [id], [role], [resource_group], [can_view], [can_create], [can_edit], [can_delete] FROM [dbo].[role_access_matrix] WITH (UPDLOCK, HOLDLOCK) WHERE [role] = :role AND [resource_group] = :resource_group",
    { replacements: KEY, transaction },
  );
  return rows[0];
}

function auditRow(id, action, actor, before, after, now) {
  return {
    id,
    actor_subject: actor,
    action,
    object_type: "ROLE_ACCESS_MATRIX",
    object_id: MATRIX_ID,
    data_before: before ? JSON.stringify(before) : null,
    data_after: after ? JSON.stringify(after) : null,
    created_at: now,
  };
}

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const existing = await findSeededRow(queryInterface, transaction);
      if (!existing) {
        const now = new Date();
        await queryInterface.bulkInsert("role_access_matrix", [{
          ...ACCESS,
          created_at: now,
          updated_at: now,
        }], { transaction });
        await queryInterface.bulkInsert("audit_trail", [
          auditRow(SEED_AUDIT_ID, "CREATE", "SYSTEM:ST03_SEED", null, ACCESS, now),
        ], { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const existing = await findSeededRow(queryInterface, transaction);
      if (existing) {
        const now = new Date();
        await queryInterface.bulkDelete("role_access_matrix", { id: existing.id }, { transaction });
        await queryInterface.bulkInsert("audit_trail", [
          auditRow(ROLLBACK_AUDIT_ID, "DELETE", "SYSTEM:ST03_SEED_ROLLBACK", existing, null, now),
        ], { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
