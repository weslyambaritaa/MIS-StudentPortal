"use strict";

const ids = {
  industry: "10000000-0000-4000-8000-000000000001",
  category: "10000000-0000-4000-8000-000000000002",
  course: "10000000-0000-4000-8000-000000000003",
  syllabus: "10000000-0000-4000-8000-000000000004",
  corp: "10000000-0000-4000-8000-000000000005",
  personal: "10000000-0000-4000-8000-000000000006",
  quotation: "10000000-0000-4000-8000-000000000007",
  quotationOrder: "10000000-0000-4000-8000-000000000008",
  rfPublic: "10000000-0000-4000-8000-000000000009",
  rfPrivate: "10000000-0000-4000-8000-000000000010",
  trainingPublic: "10000000-0000-4000-8000-000000000011",
  trainingPrivate: "10000000-0000-4000-8000-000000000012",
  sessionPublic: "10000000-0000-4000-8000-000000000013",
  sessionPrivate: "10000000-0000-4000-8000-000000000014",
  participantPublic: "10000000-0000-4000-8000-000000000015",
  participantPrivate: "10000000-0000-4000-8000-000000000016",
  attendancePublic: "10000000-0000-4000-8000-000000000017",
  attendancePrivate: "10000000-0000-4000-8000-000000000018",
  evaluationPublic: "10000000-0000-4000-8000-000000000019",
  evaluationPrivate: "10000000-0000-4000-8000-000000000020",
  certificateTemplate: "10000000-0000-4000-8000-000000000021",
  certificate: "10000000-0000-4000-8000-000000000022",
  room: "10000000-0000-4000-8000-000000000023",
  booking: "10000000-0000-4000-8000-000000000024",
  material: "10000000-0000-4000-8000-000000000025",
  invoice: "10000000-0000-4000-8000-000000000026",
  invoiceDetail: "10000000-0000-4000-8000-000000000027",
  notificationTemplate: "10000000-0000-4000-8000-000000000028",
};

async function insertIfMissing(qi, table, row) {
  const [rows] = await qi.sequelize.query(`SELECT id FROM ${table} WHERE id = :id`, { replacements: { id: row.id } });
  if (!rows.length) await qi.bulkInsert(table, [row]);
}

module.exports = {
  async up(qi, Sequelize) {
    const environment = process.env.NODE_ENV || "development";
    if (!["development", "test"].includes(environment)) throw new Error("EN-03 sample data is restricted to development/test.");
    const now = new Date();
    const ts = { created_at: now, updated_at: now };
    const rows = [
      ["industry", { id: ids.industry, name: "Technology", status: "ACTIVE", ...ts }],
      ["course_category", { id: ids.category, name: "Core Skills", ...ts }],
      ["course", { id: ids.course, category_id: ids.category, name: "Communication Fundamentals", duration_minutes: 480, level: "BEGINNER", module_url: null, status: "ACTIVE", ...ts }],
      ["syllabus", { id: ids.syllabus, course_id: ids.course, file_url: "https://example.invalid/syllabus/communication.pdf", ...ts }],
      ["account", { id: ids.corp, name: "Sample Corporate Account", account_type: "CORPORATE", industry_id: ids.industry, status: "ACTIVE", created_at: now, updated_at: now }],
      ["account", { id: ids.personal, name: "Sample Personal Account", account_type: "PERSONAL", industry_id: null, status: "ACTIVE", created_at: now, updated_at: now }],
      ["quotation", { id: ids.quotation, account_id: ids.corp, created_by_subject: null, status: "APPROVED", sent_at: now, ...ts }],
      ["quotation_order", { id: ids.quotationOrder, quotation_id: ids.quotation, course_id: ids.course, class_type: "PUBLIC", amount_student: 10, price: 1000000, location: "Jakarta", ...ts }],
      ["request_form", { id: ids.rfPublic, quotation_id: ids.quotation, created_by_subject: null, reviewed_by_subject: null, attachment_file: null, training_title: "Sample Public Training", request_date: now, language: "id", training_type: "PUBLIC", number_student: 10, room_rental: false, special_instruction: null, approved_at: now, ...ts }],
      ["request_form", { id: ids.rfPrivate, quotation_id: null, created_by_subject: null, reviewed_by_subject: null, attachment_file: null, training_title: "Sample Private Training", request_date: now, language: "id", training_type: "PRIVATE", number_student: 1, room_rental: true, special_instruction: null, approved_at: now, ...ts }],
      ["training", { id: ids.trainingPublic, account_id: ids.corp, course_id: ids.course, request_form_id: ids.rfPublic, name: "Sample Public Training", training_type: "PUBLIC", status: "SCHEDULED", ...ts }],
      ["training", { id: ids.trainingPrivate, account_id: ids.personal, course_id: ids.course, request_form_id: ids.rfPrivate, name: "Sample Private Training", training_type: "PRIVATE", status: "SCHEDULED", ...ts }],
      ["training_session", { id: ids.sessionPublic, training_id: ids.trainingPublic, session_number: 1, starts_at: now, ends_at: new Date(now.getTime() + 3600000), class_location: "ONLINE", zoom_url: null, agenda: "Introduction", ...ts }],
      ["training_session", { id: ids.sessionPrivate, training_id: ids.trainingPrivate, session_number: 1, starts_at: now, ends_at: new Date(now.getTime() + 3600000), class_location: "OFFLINE", zoom_url: null, agenda: "Introduction", ...ts }],
      ["participant", { id: ids.participantPublic, training_id: ids.trainingPublic, student_id: null, full_name: "Demo Participant Public", registered_at: now, ...ts }],
      ["participant", { id: ids.participantPrivate, training_id: ids.trainingPrivate, student_id: null, full_name: "Demo Participant Personal", registered_at: now, ...ts }],
      ["attendance", { id: ids.attendancePublic, participant_id: ids.participantPublic, session_id: ids.sessionPublic, status: "PRESENT", checkin_time: now, ...ts }],
      ["attendance", { id: ids.attendancePrivate, participant_id: ids.participantPrivate, session_id: ids.sessionPrivate, status: "PRESENT", checkin_time: now, ...ts }],
      ["evaluation", { id: ids.evaluationPublic, participant_id: ids.participantPublic, training_id: ids.trainingPublic, score: 90, comment: "Sample evaluation", submitted_at: now, ...ts }],
      ["evaluation", { id: ids.evaluationPrivate, participant_id: ids.participantPrivate, training_id: ids.trainingPrivate, score: 85, comment: "Sample evaluation", submitted_at: now, ...ts }],
      ["certificate_template", { id: ids.certificateTemplate, template_name: "Sample Completion Template", design_file: null, series_format: "DEMO-{YEAR}-{SEQUENCE}", signature: null, publish_criteria: "Training completion", ...ts }],
      ["certificate", { id: ids.certificate, template_id: ids.certificateTemplate, training_id: ids.trainingPublic, participant_id: ids.participantPublic, alias_name: null, is_alias: false, serial_number: "DEMO-2026-0001", publish_date: now, ...ts }],
      ["room", { id: ids.room, name: "Demo Room", capacity: 20, facilities: "Projector", status: "AVAILABLE", ...ts }],
      ["booking_room", { id: ids.booking, session_id: ids.sessionPrivate, room_id: ids.room, booking_name: "Sample Session Booking", detail_booking: null, start_time: "09:00:00", end_time: "10:00:00", ...ts }],
      ["class_material", { id: ids.material, training_id: ids.trainingPublic, material_url: "https://example.invalid/material/intro.pdf", ...ts }],
      ["invoice", { id: ids.invoice, account_id: ids.personal, created_by_subject: null, sales_subject: null, bill_to_name: "Sample Personal Account", bill_to_address: null, description: "Sample training invoice", subtotal: 500000, grand_total: 500000, status: "DRAFT", due_date: null, publish_date: null, ...ts }],
      ["invoice_detail", { id: ids.invoiceDetail, invoice_id: ids.invoice, training_id: ids.trainingPrivate, participant_id: ids.participantPrivate, description: "Sample private training participant", quantity: 1, unit_price: 500000, amount: 500000, ...ts }],
      ["notification_template", { id: ids.notificationTemplate, name: "Sample Training Notice", subject_email: "Training information", content: "Development sample only", is_active: false, ...ts }],
    ];
    for (const [table, row] of rows) await insertIfMissing(qi, table, row);
  },
  async down(qi) {
    if (!["development", "test"].includes(process.env.NODE_ENV || "development")) throw new Error("EN-03 sample data is restricted to development/test.");
    for (const [table, id] of [["notification_template", ids.notificationTemplate], ["invoice_detail", ids.invoiceDetail], ["invoice", ids.invoice], ["class_material", ids.material], ["booking_room", ids.booking], ["room", ids.room], ["certificate", ids.certificate], ["certificate_template", ids.certificateTemplate], ["evaluation", ids.evaluationPrivate], ["evaluation", ids.evaluationPublic], ["attendance", ids.attendancePrivate], ["attendance", ids.attendancePublic], ["participant", ids.participantPrivate], ["participant", ids.participantPublic], ["training_session", ids.sessionPrivate], ["training_session", ids.sessionPublic], ["training", ids.trainingPrivate], ["training", ids.trainingPublic], ["request_form", ids.rfPrivate], ["request_form", ids.rfPublic], ["quotation_order", ids.quotationOrder], ["quotation", ids.quotation], ["syllabus", ids.syllabus], ["course", ids.course], ["course_category", ids.category], ["account", ids.personal], ["account", ids.corp], ["industry", ids.industry]]) {
      const [found] = await qi.sequelize.query(`SELECT id FROM ${table} WHERE id = :id`, { replacements: { id } });
      if (found.length) await qi.bulkDelete(table, { id });
    }
  },
};
