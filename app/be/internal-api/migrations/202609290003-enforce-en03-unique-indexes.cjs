"use strict";

module.exports = {
  async up(queryInterface) {
    const indexes = [
      ["industry", ["name"], "uq_industry_name"],
      ["course_category", ["name"], "uq_course_category_name"],
      ["certificate_template", ["template_name"], "uq_certificate_template_name"],
      ["certificate", ["serial_number"], "uq_certificate_serial_number"],
      ["room", ["name"], "uq_room_name"],
      ["notification_template", ["name"], "uq_notification_template_name"],
    ];
    for (const [table, fields, name] of indexes) await queryInterface.addIndex(table, fields, { name, unique: true });
  },
  async down(queryInterface) {
    for (const [table, name] of [
      ["notification_template", "uq_notification_template_name"],
      ["room", "uq_room_name"],
      ["certificate", "uq_certificate_serial_number"],
      ["certificate_template", "uq_certificate_template_name"],
      ["course_category", "uq_course_category_name"],
      ["industry", "uq_industry_name"],
    ]) await queryInterface.removeIndex(table, name);
  },
};
