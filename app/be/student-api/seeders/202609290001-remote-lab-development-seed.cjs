"use strict";

const row = {
  id: "20000000-0000-4000-8000-000000000001",
  // Logical reference to the deterministic development training seed in Internal API.
  training_id: "10000000-0000-4000-8000-000000000011",
  lab_url: "https://example.invalid/labs/sample",
  start_period: "2026-01-01",
  end_period: "2026-12-31",
  created_at: new Date(),
  updated_at: new Date(),
};

module.exports = {
  async up(queryInterface) {
    const environment = process.env.NODE_ENV || "development";
    if (!["development", "test"].includes(environment)) throw new Error("EN-03 sample data is restricted to development/test.");
    const [rows] = await queryInterface.sequelize.query("SELECT id FROM remote_lab WHERE id = :id", { replacements: { id: row.id } });
    if (!rows.length) await queryInterface.bulkInsert("remote_lab", [row]);
  },
  async down(queryInterface) {
    if (!["development", "test"].includes(process.env.NODE_ENV || "development")) throw new Error("EN-03 sample data is restricted to development/test.");
    await queryInterface.bulkDelete("remote_lab", { id: row.id });
  },
};
