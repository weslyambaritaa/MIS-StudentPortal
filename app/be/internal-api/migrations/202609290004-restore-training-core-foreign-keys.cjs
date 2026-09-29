"use strict";

const relations = [
  { column: "course_id", name: "fk_training_course_id", table: "course" },
  { column: "request_form_id", name: "fk_training_request_form_id", table: "request_form" },
];

module.exports = {
  async up(queryInterface) {
    for (const relation of relations) {
      const [rows] = await queryInterface.sequelize.query(
        "SELECT fk.name FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fk.object_id=fkc.constraint_object_id JOIN sys.tables pt ON pt.object_id=fkc.parent_object_id JOIN sys.columns pc ON pc.object_id=fkc.parent_object_id AND pc.column_id=fkc.parent_column_id WHERE pt.name=:tableName AND pc.name=:columnName",
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
        "SELECT fk.name FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fk.object_id=fkc.constraint_object_id JOIN sys.tables pt ON pt.object_id=fkc.parent_object_id JOIN sys.columns pc ON pc.object_id=fkc.parent_object_id AND pc.column_id=fkc.parent_column_id WHERE pt.name=:tableName AND pc.name=:columnName",
        { replacements: { tableName: "training", columnName: relation.column } },
      );
      for (const row of rows) await queryInterface.removeConstraint("training", row.name);
    }
  },
};
