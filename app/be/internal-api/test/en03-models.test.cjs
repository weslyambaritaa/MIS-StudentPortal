const test = require("node:test");
const assert = require("node:assert/strict");
const models = require("../dist/database/models");

test("EN-03 domain models register required SQL Server tables", () => {
  const tables = [
    "industry", "course_category", "course", "syllabus", "quotation", "quotation_order", "request_form",
    "attendance", "evaluation", "certificate_template", "certificate", "room", "booking_room", "class_material",
    "invoice", "invoice_detail", "audit_trail", "import_batches", "import_row", "provisioning_logs",
    "notification_template", "notification_log",
  ];
  for (const tableName of tables) {
    assert.ok(Object.values(models).some((model) => model?.getTableName?.() === tableName), `missing Sequelize model for ${tableName}`);
  }
});

test("EN-03 same-database relations and invariants are represented in models", () => {
  assert.equal(models.Course.associations.category?.target, models.CourseCategory);
  assert.equal(models.Training.associations.requestForm?.target, models.RequestForm);
  assert.equal(models.Attendance.associations.session?.target, models.TrainingSession);
  assert.equal(models.InvoiceDetail.associations.participant?.target, models.Participant);
  assert.ok(models.Attendance.options.indexes.some((index) => index.unique && index.fields.join(",") === "participant_id,session_id"));
  assert.ok(models.Evaluation.options.indexes.some((index) => index.unique && index.fields.join(",") === "participant_id,training_id"));
});

test("existing actor identity stays logical and Trainer certification is a nullable date", () => {
  assert.equal(models.TrainerProfile.rawAttributes.certification_expired.allowNull, true);
  assert.equal(models.TrainerProfile.rawAttributes.certification_expired.type.key, "DATEONLY");
  assert.equal(models.Participant.rawAttributes.student_id.allowNull, true);
  assert.equal(models.Participant.rawAttributes.student_id.references, undefined);
});

test("Training models Course and Request Form relations with the allowed Training Type", () => {
  assert.equal(models.Training.rawAttributes.course_id.type.key, "UUID");
  assert.equal(models.Training.rawAttributes.request_form_id.type.key, "UUID");
  assert.equal(models.Training.rawAttributes.training_type.allowNull, true, "legacy rows remain migratable; domain flows must require type");
  assert.equal(models.Training.associations.course?.target, models.Course);
  assert.equal(models.Training.associations.requestForm?.target, models.RequestForm);
});

test("single-column business keys use explicit named unique indexes", () => {
  for (const [model, name] of [
    [models.Industry, "uq_industry_name"],
    [models.CourseCategory, "uq_course_category_name"],
    [models.Certificate, "uq_certificate_serial_number"],
    [models.Room, "uq_room_name"],
  ]) assert.ok(model.options.indexes.some((index) => index.name === name && index.unique), `missing ${name}`);
});
