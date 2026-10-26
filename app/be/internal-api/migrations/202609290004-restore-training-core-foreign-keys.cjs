"use strict";

const relations = [
  { column: "course_id", name: "fk_training_course_id", table: "course" },
  { column: "request_form_id", name: "fk_training_request_form_id", table: "request_form" },
];

module.exports = {
  async up(queryInterface) {
    for (const relation of relations) {
      const [rows] = await queryInterface.sequelize.query(
        "SELECT con.conname AS name FROM pg_constraint con JOIN pg_class tbl ON tbl.oid=con.conrelid JOIN pg_attribute col ON col.attrelid=tbl.oid AND col.attnum=ANY(con.conkey) WHERE con.contype='f' AND tbl.relname=:tableName AND col.attname=:columnName",
        { replacements: { tableName: "training", columnName: relation.column } },
      );
      if (!rows.length) {
        await queryInterface.addConstraint("training", {
          fields: [relation.column], type: "foreign key", name: relation.name,
          references: { table: relation.table, field: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION",
        });
      }
    }
  },
  async down(queryInterface) {
    for (const relation of relations) {
      const [rows] = await queryInterface.sequelize.query(
        "SELECT con.conname AS name FROM pg_constraint con JOIN pg_class tbl ON tbl.oid=con.conrelid JOIN pg_attribute col ON col.attrelid=tbl.oid AND col.attnum=ANY(con.conkey) WHERE con.contype='f' AND tbl.relname=:tableName AND col.attname=:columnName",
        { replacements: { tableName: "training", columnName: relation.column } },
      );
      for (const row of rows) await queryInterface.removeConstraint("training", row.name);
    }
  },
};
