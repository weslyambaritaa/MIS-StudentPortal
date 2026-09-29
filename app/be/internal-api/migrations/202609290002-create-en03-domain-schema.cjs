"use strict";

const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("GETUTCDATE()") },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("GETUTCDATE()") },
});

const check = async (qi, name, expression, transaction) =>
  qi.sequelize.query(`ALTER TABLE ${name.split(".")[0]} ADD CONSTRAINT ${name.split(".")[1]} CHECK (${expression})`, { transaction });

module.exports = {
  async up(qi, S) {
    const t = await qi.sequelize.transaction();
    try {
      await qi.addColumn("trainer_profile", "certification_expired", { type: S.DATEONLY, allowNull: true }, { transaction: t });
      await qi.createTable("industry", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        name: { type: S.STRING(150), allowNull: false, unique: "uq_industry_name" },
        status: { type: S.STRING(20), allowNull: false, defaultValue: "ACTIVE" }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "industry.ck_industry_status", "status IN ('ACTIVE','INACTIVE')", t);

      await qi.createTable("course_category", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        name: { type: S.STRING(150), allowNull: false, unique: "uq_course_category_name" }, ...timestamps(S),
      }, { transaction: t });
      await qi.createTable("course", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        category_id: { type: S.UUID, allowNull: false, references: { model: "course_category", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        name: { type: S.STRING(150), allowNull: false },
        duration_minutes: { type: S.INTEGER, allowNull: false },
        level: { type: S.STRING(20), allowNull: false },
        module_url: { type: S.STRING(255), allowNull: true },
        status: { type: S.STRING(20), allowNull: false, defaultValue: "ACTIVE" }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "course.ck_course_duration_positive", "duration_minutes > 0", t);
      await check(qi, "course.ck_course_level", "level IN ('BEGINNER','INTERMEDIATE','ADVANCED')", t);
      await check(qi, "course.ck_course_status", "status IN ('ACTIVE','INACTIVE')", t);
      await qi.addIndex("course", ["category_id"], { name: "ix_course_category_id", transaction: t });

      await qi.addColumn("account", "industry_id", {
        type: S.UUID, allowNull: true,
        references: { model: "industry", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION",
      }, { transaction: t });
      await qi.addColumn("account", "status", { type: S.STRING(20), allowNull: false, defaultValue: "ACTIVE" }, { transaction: t });
      await check(qi, "account.ck_account_status", "status IN ('ACTIVE','INACTIVE')", t);
      await qi.addIndex("account", ["industry_id"], { name: "ix_account_industry_id", transaction: t });

      await qi.createTable("syllabus", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        course_id: { type: S.UUID, allowNull: false, references: { model: "course", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        file_url: { type: S.STRING(255), allowNull: false }, ...timestamps(S),
      }, { transaction: t });
      await qi.addIndex("syllabus", ["course_id"], { name: "ix_syllabus_course_id", transaction: t });

      await qi.createTable("quotation", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        account_id: { type: S.UUID, allowNull: false, references: { model: "account", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        created_by_subject: { type: S.STRING(255), allowNull: true },
        status: { type: S.STRING(20), allowNull: false, defaultValue: "DRAFT" },
        sent_at: { type: S.DATE, allowNull: true }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "quotation.ck_quotation_status", "status IN ('DRAFT','SENT','APPROVED','REJECTED','EXPIRED')", t);
      await qi.addIndex("quotation", ["account_id"], { name: "ix_quotation_account_id", transaction: t });

      await qi.createTable("quotation_order", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        quotation_id: { type: S.UUID, allowNull: false, references: { model: "quotation", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        course_id: { type: S.UUID, allowNull: false, references: { model: "course", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        class_type: { type: S.STRING(20), allowNull: false },
        amount_student: { type: S.INTEGER, allowNull: false },
        price: { type: S.DECIMAL(19, 4), allowNull: false },
        location: { type: S.STRING(255), allowNull: true }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "quotation_order.ck_quotation_order_class_type", "class_type IN ('PUBLIC','PRIVATE')", t);
      await check(qi, "quotation_order.ck_quotation_order_amount_positive", "amount_student > 0", t);
      await check(qi, "quotation_order.ck_quotation_order_price_nonnegative", "price >= 0", t);
      await qi.addIndex("quotation_order", ["quotation_id"], { name: "ix_quotation_order_quotation_id", transaction: t });
      await qi.addIndex("quotation_order", ["course_id"], { name: "ix_quotation_order_course_id", transaction: t });

      await qi.createTable("request_form", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        quotation_id: { type: S.UUID, allowNull: true, references: { model: "quotation", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        created_by_subject: { type: S.STRING(255), allowNull: true },
        reviewed_by_subject: { type: S.STRING(255), allowNull: true },
        attachment_file: { type: S.STRING(255), allowNull: true },
        training_title: { type: S.STRING(255), allowNull: false },
        request_date: { type: S.DATEONLY, allowNull: false },
        language: { type: S.STRING(50), allowNull: true },
        training_type: { type: S.STRING(20), allowNull: false },
        number_student: { type: S.INTEGER, allowNull: false },
        room_rental: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        special_instruction: { type: S.TEXT, allowNull: true },
        approved_at: { type: S.DATE, allowNull: true }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "request_form.ck_request_form_training_type", "training_type IN ('PUBLIC','PRIVATE')", t);
      await check(qi, "request_form.ck_request_form_number_student", "number_student > 0", t);
      await qi.addIndex("request_form", ["quotation_id"], { name: "ix_request_form_quotation_id", transaction: t });

      await qi.addColumn("training", "course_id", {
        type: S.UUID, allowNull: true,
        references: { model: "course", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION",
      }, { transaction: t });
      await qi.addColumn("training", "request_form_id", {
        type: S.UUID, allowNull: true,
        references: { model: "request_form", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION",
      }, { transaction: t });
      await qi.addColumn("training", "training_type", { type: S.STRING(20), allowNull: true }, { transaction: t });
      await qi.addColumn("training", "status", { type: S.STRING(20), allowNull: false, defaultValue: "DRAFT" }, { transaction: t });
      await check(qi, "training.ck_training_type", "training_type IS NULL OR training_type IN ('PUBLIC','PRIVATE')", t);
      await check(qi, "training.ck_training_status", "status IN ('DRAFT','SCHEDULED','ONGOING','COMPLETED','CANCELLED')", t);
      await qi.addIndex("training", ["course_id"], { name: "ix_training_course_id", transaction: t });
      await qi.addIndex("training", ["request_form_id"], { name: "ix_training_request_form_id", transaction: t });

      await qi.addColumn("training_session", "class_location", { type: S.STRING(20), allowNull: true }, { transaction: t });
      await qi.addColumn("training_session", "zoom_url", { type: S.STRING(255), allowNull: true }, { transaction: t });
      await qi.addColumn("training_session", "agenda", { type: S.STRING(255), allowNull: true }, { transaction: t });
      await check(qi, "training_session.ck_training_session_class_location", "class_location IS NULL OR class_location IN ('ONLINE','OFFLINE','HYBRID')", t);

      await qi.addColumn("participant", "registered_at", { type: S.DATE, allowNull: false, defaultValue: S.literal("GETUTCDATE()") }, { transaction: t });
      await qi.createTable("attendance", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        participant_id: { type: S.UUID, allowNull: false, references: { model: "participant", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        session_id: { type: S.UUID, allowNull: false, references: { model: "training_session", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        status: { type: S.STRING(20), allowNull: false }, checkin_time: { type: S.DATE, allowNull: true }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "attendance.ck_attendance_status", "status IN ('PRESENT','ABSENT','LATE','EXCUSED')", t);
      await qi.addIndex("attendance", ["participant_id", "session_id"], { name: "uq_attendance_participant_session", unique: true, transaction: t });
      await qi.addIndex("attendance", ["session_id"], { name: "ix_attendance_session_id", transaction: t });

      await qi.createTable("evaluation", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        participant_id: { type: S.UUID, allowNull: false, references: { model: "participant", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        training_id: { type: S.UUID, allowNull: false, references: { model: "training", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        score: { type: S.INTEGER, allowNull: true }, comment: { type: S.STRING(255), allowNull: true },
        submitted_at: { type: S.DATE, allowNull: false, defaultValue: S.literal("GETUTCDATE()") }, ...timestamps(S),
      }, { transaction: t });
      await qi.addIndex("evaluation", ["participant_id", "training_id"], { name: "uq_evaluation_participant_training", unique: true, transaction: t });
      await qi.addIndex("evaluation", ["training_id"], { name: "ix_evaluation_training_id", transaction: t });

      await qi.createTable("certificate_template", {
        id: { type: S.UUID, allowNull: false, primaryKey: true }, template_name: { type: S.STRING(150), allowNull: false, unique: "uq_certificate_template_name" },
        design_file: { type: S.STRING(255), allowNull: true }, series_format: { type: S.STRING(255), allowNull: true }, signature: { type: S.STRING(255), allowNull: true }, publish_criteria: { type: S.TEXT, allowNull: true }, ...timestamps(S),
      }, { transaction: t });
      await qi.createTable("certificate", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        template_id: { type: S.UUID, allowNull: false, references: { model: "certificate_template", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        training_id: { type: S.UUID, allowNull: false, references: { model: "training", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        participant_id: { type: S.UUID, allowNull: false, references: { model: "participant", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        alias_name: { type: S.STRING(150), allowNull: true }, is_alias: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        serial_number: { type: S.STRING(255), allowNull: false, unique: "uq_certificate_serial_number" }, publish_date: { type: S.DATEONLY, allowNull: true }, ...timestamps(S),
      }, { transaction: t });
      await qi.addIndex("certificate", ["training_id"], { name: "ix_certificate_training_id", transaction: t });
      await qi.addIndex("certificate", ["participant_id"], { name: "ix_certificate_participant_id", transaction: t });

      await qi.createTable("room", {
        id: { type: S.UUID, allowNull: false, primaryKey: true }, name: { type: S.STRING(150), allowNull: false, unique: "uq_room_name" },
        capacity: { type: S.INTEGER, allowNull: false }, facilities: { type: S.STRING(255), allowNull: true },
        status: { type: S.STRING(20), allowNull: false, defaultValue: "AVAILABLE" }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "room.ck_room_capacity_positive", "capacity > 0", t);
      await check(qi, "room.ck_room_status", "status IN ('AVAILABLE','UNAVAILABLE','MAINTENANCE')", t);
      await qi.createTable("booking_room", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        session_id: { type: S.UUID, allowNull: false, references: { model: "training_session", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        room_id: { type: S.UUID, allowNull: false, references: { model: "room", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        booking_name: { type: S.STRING(150), allowNull: true }, detail_booking: { type: S.STRING(255), allowNull: true },
        start_time: { type: S.TIME, allowNull: false }, end_time: { type: S.TIME, allowNull: false }, ...timestamps(S),
      }, { transaction: t });
      await qi.addIndex("booking_room", ["session_id"], { name: "ix_booking_room_session_id", transaction: t });
      await qi.addIndex("booking_room", ["room_id"], { name: "ix_booking_room_room_id", transaction: t });

      await qi.createTable("class_material", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        training_id: { type: S.UUID, allowNull: false, references: { model: "training", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        material_url: { type: S.STRING(255), allowNull: false }, ...timestamps(S),
      }, { transaction: t });
      await qi.addIndex("class_material", ["training_id"], { name: "ix_class_material_training_id", transaction: t });

      await qi.createTable("invoice", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        account_id: { type: S.UUID, allowNull: false, references: { model: "account", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        created_by_subject: { type: S.STRING(255), allowNull: true }, sales_subject: { type: S.STRING(255), allowNull: true },
        bill_to_name: { type: S.STRING(150), allowNull: false }, bill_to_address: { type: S.STRING(255), allowNull: true }, description: { type: S.STRING(255), allowNull: true },
        subtotal: { type: S.DECIMAL(19, 4), allowNull: false, defaultValue: 0 }, grand_total: { type: S.DECIMAL(19, 4), allowNull: false, defaultValue: 0 },
        status: { type: S.STRING(20), allowNull: false, defaultValue: "DRAFT" }, due_date: { type: S.DATEONLY, allowNull: true }, publish_date: { type: S.DATE, allowNull: true }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "invoice.ck_invoice_status", "status IN ('DRAFT','PUBLISHED','PAID','CANCELLED')", t);
      await check(qi, "invoice.ck_invoice_amounts_nonnegative", "subtotal >= 0 AND grand_total >= 0", t);
      await qi.addIndex("invoice", ["account_id"], { name: "ix_invoice_account_id", transaction: t });
      await qi.createTable("invoice_detail", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        invoice_id: { type: S.UUID, allowNull: false, references: { model: "invoice", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        training_id: { type: S.UUID, allowNull: true, references: { model: "training", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        participant_id: { type: S.UUID, allowNull: true, references: { model: "participant", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        description: { type: S.STRING(255), allowNull: false }, quantity: { type: S.INTEGER, allowNull: false, defaultValue: 1 },
        unit_price: { type: S.DECIMAL(19, 4), allowNull: false }, amount: { type: S.DECIMAL(19, 4), allowNull: false }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "invoice_detail.ck_invoice_detail_reference", "training_id IS NOT NULL OR participant_id IS NOT NULL", t);
      await check(qi, "invoice_detail.ck_invoice_detail_quantity", "quantity > 0", t);
      await check(qi, "invoice_detail.ck_invoice_detail_amounts", "unit_price >= 0 AND amount >= 0", t);
      await qi.addIndex("invoice_detail", ["invoice_id"], { name: "ix_invoice_detail_invoice_id", transaction: t });
      await qi.addIndex("invoice_detail", ["training_id"], { name: "ix_invoice_detail_training_id", transaction: t });
      await qi.addIndex("invoice_detail", ["participant_id"], { name: "ix_invoice_detail_participant_id", transaction: t });

      await qi.createTable("audit_trail", {
        id: { type: S.UUID, allowNull: false, primaryKey: true }, actor_subject: { type: S.STRING(255), allowNull: true },
        action: { type: S.STRING(50), allowNull: false }, object_type: { type: S.STRING(50), allowNull: false }, object_id: { type: S.STRING(100), allowNull: true },
        data_before: { type: S.TEXT("long"), allowNull: true }, data_after: { type: S.TEXT("long"), allowNull: true },
        created_at: { type: S.DATE, allowNull: false, defaultValue: S.literal("GETUTCDATE()") },
      }, { transaction: t });
      await qi.addIndex("audit_trail", ["actor_subject", "created_at"], { name: "ix_audit_trail_actor_created", transaction: t });
      await qi.addIndex("audit_trail", ["object_type", "object_id"], { name: "ix_audit_trail_object", transaction: t });

      await qi.createTable("import_batches", {
        id: { type: S.UUID, allowNull: false, primaryKey: true }, created_by_subject: { type: S.STRING(255), allowNull: true },
        filename: { type: S.STRING(255), allowNull: false }, uploaded_at: { type: S.DATE, allowNull: false, defaultValue: S.literal("GETUTCDATE()") },
        status: { type: S.STRING(20), allowNull: false, defaultValue: "PENDING" }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "import_batches.ck_import_batches_status", "status IN ('PENDING','PROCESSING','COMPLETED','FAILED')", t);
      await qi.createTable("import_row", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        batch_id: { type: S.UUID, allowNull: false, references: { model: "import_batches", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        row_number: { type: S.INTEGER, allowNull: false }, raw_data: { type: S.TEXT("long"), allowNull: false },
        validation_status: { type: S.STRING(20), allowNull: false, defaultValue: "PENDING" }, error_message: { type: S.STRING(255), allowNull: true }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "import_row.ck_import_row_status", "validation_status IN ('PENDING','VALID','INVALID','PROCESSED','FAILED')", t);
      await qi.addIndex("import_row", ["batch_id", "row_number"], { name: "uq_import_row_batch_number", unique: true, transaction: t });

      await qi.createTable("provisioning_logs", {
        id: { type: S.UUID, allowNull: false, primaryKey: true }, batch_id: { type: S.UUID, allowNull: true, references: { model: "import_batches", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        keycloak_subject: { type: S.STRING(255), allowNull: true }, email: { type: S.STRING(150), allowNull: true },
        target_role: { type: S.STRING(20), allowNull: false }, status: { type: S.STRING(20), allowNull: false, defaultValue: "PENDING" },
        sent_at: { type: S.DATE, allowNull: true }, error_message: { type: S.STRING(1000), allowNull: true }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "provisioning_logs.ck_provisioning_target_role", "target_role IN ('pic','student')", t);
      await check(qi, "provisioning_logs.ck_provisioning_status", "status IN ('PENDING','PROCESSING','COMPLETED','FAILED')", t);
      await qi.addIndex("provisioning_logs", ["batch_id"], { name: "ix_provisioning_logs_batch_id", transaction: t });
      await qi.addIndex("provisioning_logs", ["status"], { name: "ix_provisioning_logs_status", transaction: t });

      await qi.createTable("notification_template", {
        id: { type: S.UUID, allowNull: false, primaryKey: true }, name: { type: S.STRING(150), allowNull: false, unique: "uq_notification_template_name" },
        subject_email: { type: S.STRING(150), allowNull: false }, content: { type: S.TEXT("long"), allowNull: false }, is_active: { type: S.BOOLEAN, allowNull: false, defaultValue: true }, ...timestamps(S),
      }, { transaction: t });
      await qi.createTable("notification_log", {
        id: { type: S.UUID, allowNull: false, primaryKey: true },
        template_id: { type: S.UUID, allowNull: true, references: { model: "notification_template", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
        sent_by_subject: { type: S.STRING(255), allowNull: true }, recipient_email: { type: S.STRING(150), allowNull: false },
        sent_at: { type: S.DATE, allowNull: true }, status: { type: S.STRING(20), allowNull: false, defaultValue: "PENDING" }, ...timestamps(S),
      }, { transaction: t });
      await check(qi, "notification_log.ck_notification_log_status", "status IN ('PENDING','SENT','FAILED')", t);
      await qi.addIndex("notification_log", ["template_id"], { name: "ix_notification_log_template_id", transaction: t });
      await qi.addIndex("notification_log", ["status"], { name: "ix_notification_log_status", transaction: t });

      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  async down(qi) {
    const t = await qi.sequelize.transaction();
    try {
      await qi.removeIndex("training", "ix_training_request_form_id", { transaction: t });
      await qi.removeIndex("training", "ix_training_course_id", { transaction: t });
      await qi.removeConstraint("training", "ck_training_status", { transaction: t });
      await qi.removeConstraint("training", "ck_training_type", { transaction: t });
      await qi.removeColumn("training", "status", { transaction: t });
      await qi.removeColumn("training", "training_type", { transaction: t });
      await qi.removeColumn("training", "request_form_id", { transaction: t });
      await qi.removeColumn("training", "course_id", { transaction: t });
      await qi.removeIndex("account", "ix_account_industry_id", { transaction: t });
      await qi.removeConstraint("account", "ck_account_status", { transaction: t });
      await qi.removeColumn("account", "status", { transaction: t });
      await qi.removeColumn("account", "industry_id", { transaction: t });
      for (const table of ["notification_log", "notification_template", "provisioning_logs", "import_row", "import_batches", "audit_trail", "invoice_detail", "invoice", "class_material", "booking_room", "room", "certificate", "certificate_template", "evaluation", "attendance", "request_form", "quotation_order", "quotation", "syllabus", "course", "course_category"]) {
        await qi.dropTable(table, { transaction: t });
      }
      await qi.removeColumn("training_session", "agenda", { transaction: t });
      await qi.removeColumn("training_session", "zoom_url", { transaction: t });
      await qi.removeConstraint("training_session", "ck_training_session_class_location", { transaction: t });
      await qi.removeColumn("training_session", "class_location", { transaction: t });
      await qi.removeColumn("participant", "registered_at", { transaction: t });
      await qi.dropTable("industry", { transaction: t });
      await qi.removeColumn("trainer_profile", "certification_expired", { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },
};
