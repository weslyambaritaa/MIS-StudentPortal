import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { Account } from "./account.model";
import { Participant } from "./participant.model";
import { Training } from "./training.model";
import { TrainingSession } from "./training-session.model";

const timestamps = { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" };
const id = { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 };

export class Industry extends Model { declare id: string; declare industry_code: string; declare name: string; declare status: "ACTIVE" | "INACTIVE"; declare created_at: Date; declare updated_at: Date; }
Industry.init({ id, industry_code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(150), allowNull: false }, status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ACTIVE", validate: { isIn: [["ACTIVE", "INACTIVE"]] } } }, { sequelize, tableName: "industry", ...timestamps, indexes: [{ name: "uq_industry_code", unique: true, fields: ["industry_code"] }, { name: "uq_industry_name", unique: true, fields: ["name"] }] });

export class CourseCategory extends Model { declare id: string; declare category_code: string; declare name: string; declare created_at: Date; declare updated_at: Date; }
CourseCategory.init({ id, category_code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(150), allowNull: false } }, { sequelize, tableName: "course_category", ...timestamps, indexes: [{ name: "uq_course_category_name", unique: true, fields: ["name"] }, { name: "uq_course_category_code", unique: true, fields: ["category_code"] }] });

export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export class Course extends Model { declare id: string; declare course_code: string; declare category_id: string; declare name: string; declare duration_minutes: number; declare level: CourseLevel; declare module_url: string | null; declare status: "ACTIVE" | "INACTIVE"; declare created_at: Date; declare updated_at: Date; }
Course.init({ id, course_code: { type: DataTypes.STRING(50), allowNull: false }, category_id: { type: DataTypes.UUID, allowNull: false }, name: { type: DataTypes.STRING(150), allowNull: false }, duration_minutes: { type: DataTypes.INTEGER, allowNull: false }, level: { type: DataTypes.STRING(20), allowNull: false }, module_url: { type: DataTypes.STRING(255), allowNull: true }, status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ACTIVE" } }, { sequelize, tableName: "course", ...timestamps, indexes: [{ name: "uq_course_code", unique: true, fields: ["course_code"] }] });

export class Syllabus extends Model { declare id: string; declare course_id: string; declare file_url: string; declare cloudinary_public_id: string | null; declare created_at: Date; declare updated_at: Date; }
Syllabus.init({ id, course_id: { type: DataTypes.UUID, allowNull: false }, file_url: { type: DataTypes.STRING(255), allowNull: false }, cloudinary_public_id: { type: DataTypes.STRING(255), allowNull: true } }, { sequelize, tableName: "syllabus", ...timestamps });

export type QuotationStatus = "DRAFT" | "SENT" | "WAITING" | "SEND_FAILED" | "APPROVED" | "CANCELLED" | "REVISION" | "REJECTED" | "EXPIRED";
export class Quotation extends Model { declare id: string; declare account_id: string; declare created_by_subject: string | null; declare status: QuotationStatus; declare sent_at: Date | null; declare quotation_code: string; declare pic_profile_id: string; declare class_type: "PRIVATE" | "PUBLIC" | "INHOUSE" | "ONLINE" | "ONLINE_PUBLIC" | "ONLINE_PRIVATE"; declare deleted_at: Date | null; declare created_at: Date; declare updated_at: Date; }
Quotation.init({ id, account_id: { type: DataTypes.UUID, allowNull: false }, created_by_subject: { type: DataTypes.STRING(255), allowNull: true }, status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "DRAFT" }, sent_at: { type: DataTypes.DATE, allowNull: true } }, { sequelize, tableName: "quotation", ...timestamps });

export type TrainingType = "PUBLIC" | "PRIVATE";
export type QuotationClassType = TrainingType | "INHOUSE" | "ONLINE";
export class QuotationOrder extends Model { declare id: string; declare quotation_id: string; declare course_id: string; declare class_type: QuotationClassType; declare amount_student: number; declare price: string; declare location: string | null; declare created_at: Date; declare updated_at: Date; }
QuotationOrder.init({ id, quotation_id: { type: DataTypes.UUID, allowNull: false }, course_id: { type: DataTypes.UUID, allowNull: false }, class_type: { type: DataTypes.STRING(20), allowNull: false }, amount_student: { type: DataTypes.INTEGER, allowNull: false }, price: { type: DataTypes.DECIMAL(19, 4), allowNull: false }, location: { type: DataTypes.STRING(255), allowNull: true } }, { sequelize, tableName: "quotation_order", ...timestamps });

export type RequestFormStatus = "DRAFT" | "WAITING" | "REVISION" | "APPROVED";
export class RequestForm extends Model { declare id: string; declare request_form_number: string; declare quotation_id: string | null; declare created_by_subject: string | null; declare reviewed_by_subject: string | null; declare attachment_file: string | null; declare training_title: string | null; declare request_date: Date | null; declare language: string | null; declare training_type: QuotationClassType | null; declare number_student: number | null; declare room_rental: boolean; declare special_instruction: string | null; declare approved_at: Date | null; declare account_id: string | null; declare pic_profile_id: string | null; declare status: RequestFormStatus; declare po_reference: string | null; declare review_note: string | null; declare sla_due_at: Date | null; declare sla_notified_at: Date | null; declare created_at: Date; declare updated_at: Date; }
RequestForm.init({ id, request_form_number: { type: DataTypes.STRING(20), allowNull: false, unique: true }, quotation_id: { type: DataTypes.UUID, allowNull: true }, created_by_subject: { type: DataTypes.STRING(255), allowNull: true }, reviewed_by_subject: { type: DataTypes.STRING(255), allowNull: true }, attachment_file: { type: DataTypes.STRING(255), allowNull: true }, training_title: { type: DataTypes.STRING(255), allowNull: true }, request_date: { type: DataTypes.DATEONLY, allowNull: true }, language: { type: DataTypes.STRING(50), allowNull: true }, training_type: { type: DataTypes.STRING(20), allowNull: true }, number_student: { type: DataTypes.INTEGER, allowNull: true }, room_rental: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, special_instruction: { type: DataTypes.TEXT, allowNull: true }, approved_at: { type: DataTypes.DATE, allowNull: true }, account_id: { type: DataTypes.UUID, allowNull: true }, pic_profile_id: { type: DataTypes.UUID, allowNull: true }, status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "DRAFT" }, po_reference: { type: DataTypes.STRING(150), allowNull: true }, review_note: { type: DataTypes.TEXT, allowNull: true }, sla_due_at: { type: DataTypes.DATE, allowNull: true }, sla_notified_at: { type: DataTypes.DATE, allowNull: true } }, { sequelize, tableName: "request_form", ...timestamps });

export class RequestFormCourse extends Model { declare id: string; declare request_form_id: string; declare course_id: string; declare delivery_type: QuotationClassType; declare service_type: "STANDARD" | "CUSTOMIZED" | "CEO"; declare amount_student: number; declare language: string; declare room_rental: boolean | null; declare room_pc: "WITH" | "WITHOUT" | null; declare room_services: string; declare location_type: "INTERNAL" | "CLIENT" | "ONLINE"; declare location_name: string | null; declare location_address: string | null; declare special_instruction: string | null; declare created_at: Date; declare updated_at: Date; }
RequestFormCourse.init({ id, request_form_id: { type: DataTypes.UUID, allowNull: false }, course_id: { type: DataTypes.UUID, allowNull: false }, delivery_type: { type: DataTypes.STRING(20), allowNull: false }, service_type: { type: DataTypes.STRING(20), allowNull: false }, amount_student: { type: DataTypes.INTEGER, allowNull: false }, language: { type: DataTypes.STRING(50), allowNull: false }, room_rental: { type: DataTypes.BOOLEAN, allowNull: true }, room_pc: { type: DataTypes.STRING(10), allowNull: true }, room_services: { type: DataTypes.TEXT, allowNull: false }, location_type: { type: DataTypes.STRING(20), allowNull: false }, location_name: { type: DataTypes.STRING(150), allowNull: true }, location_address: { type: DataTypes.STRING(500), allowNull: true }, special_instruction: { type: DataTypes.TEXT, allowNull: true } }, { sequelize, tableName: "request_form_course", ...timestamps });

export class RequestFormSession extends Model { declare id: string; declare request_form_course_id: string; declare requested_date: Date; declare start_time: string | null; declare end_time: string | null; declare created_at: Date; declare updated_at: Date; }
RequestFormSession.init({ id, request_form_course_id: { type: DataTypes.UUID, allowNull: false }, requested_date: { type: DataTypes.DATEONLY, allowNull: false }, start_time: { type: DataTypes.TIME, allowNull: true }, end_time: { type: DataTypes.TIME, allowNull: true } }, { sequelize, tableName: "request_form_session", ...timestamps });

export class RequestFormAttachment extends Model { declare id: string; declare request_form_id: string; declare file_name: string; declare file_size: number; declare file_format: string; declare cloudinary_public_id: string; declare cloudinary_asset_id: string; declare created_at: Date; declare updated_at: Date; }
RequestFormAttachment.init({ id, request_form_id: { type: DataTypes.UUID, allowNull: false }, file_name: { type: DataTypes.STRING(255), allowNull: false }, file_size: { type: DataTypes.INTEGER, allowNull: false }, file_format: { type: DataTypes.STRING(10), allowNull: false }, cloudinary_public_id: { type: DataTypes.STRING(255), allowNull: false }, cloudinary_asset_id: { type: DataTypes.STRING(255), allowNull: false } }, { sequelize, tableName: "request_form_attachment", ...timestamps });

export class Attendance extends Model { declare id: string; declare participant_id: string; declare session_id: string; declare status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; declare checkin_time: Date | null; declare created_at: Date; declare updated_at: Date; }
Attendance.init({ id, participant_id: { type: DataTypes.UUID, allowNull: false }, session_id: { type: DataTypes.UUID, allowNull: false }, status: { type: DataTypes.STRING(20), allowNull: false }, checkin_time: { type: DataTypes.DATE, allowNull: true } }, { sequelize, tableName: "attendance", ...timestamps, indexes: [{ name: "uq_attendance_participant_session", unique: true, fields: ["participant_id", "session_id"] }, { name: "ix_attendance_session_id", fields: ["session_id"] }] });

export class Evaluation extends Model { declare id: string; declare participant_id: string; declare training_id: string; declare score: number | null; declare comment: string | null; declare submitted_at: Date; declare created_at: Date; declare updated_at: Date; }
Evaluation.init({ id, participant_id: { type: DataTypes.UUID, allowNull: false }, training_id: { type: DataTypes.UUID, allowNull: false }, score: { type: DataTypes.INTEGER, allowNull: true }, comment: { type: DataTypes.STRING(255), allowNull: true }, submitted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW } }, { sequelize, tableName: "evaluation", ...timestamps, indexes: [{ name: "uq_evaluation_participant_training", unique: true, fields: ["participant_id", "training_id"] }, { name: "ix_evaluation_training_id", fields: ["training_id"] }] });

export class CertificateTemplate extends Model { declare id: string; declare template_name: string; declare design_file: string | null; declare series_format: string | null; declare signature: string | null; declare publish_criteria: string | null; declare created_at: Date; declare updated_at: Date; }
CertificateTemplate.init({ id, template_name: { type: DataTypes.STRING(150), allowNull: false }, design_file: { type: DataTypes.STRING(255), allowNull: true }, series_format: { type: DataTypes.STRING(255), allowNull: true }, signature: { type: DataTypes.STRING(255), allowNull: true }, publish_criteria: { type: DataTypes.TEXT, allowNull: true } }, { sequelize, tableName: "certificate_template", ...timestamps, indexes: [{ name: "uq_certificate_template_name", unique: true, fields: ["template_name"] }] });

export class Certificate extends Model { declare id: string; declare template_id: string; declare training_id: string; declare participant_id: string; declare alias_name: string | null; declare is_alias: boolean; declare serial_number: string; declare publish_date: Date | null; declare created_at: Date; declare updated_at: Date; }
Certificate.init({ id, template_id: { type: DataTypes.UUID, allowNull: false }, training_id: { type: DataTypes.UUID, allowNull: false }, participant_id: { type: DataTypes.UUID, allowNull: false }, alias_name: { type: DataTypes.STRING(150), allowNull: true }, is_alias: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, serial_number: { type: DataTypes.STRING(255), allowNull: false }, publish_date: { type: DataTypes.DATEONLY, allowNull: true } }, { sequelize, tableName: "certificate", ...timestamps, indexes: [{ name: "uq_certificate_serial_number", unique: true, fields: ["serial_number"] }, { name: "ix_certificate_training_id", fields: ["training_id"] }, { name: "ix_certificate_participant_id", fields: ["participant_id"] }] });

export type RoomStatus = "ACTIVE" | "INACTIVE";
export type RoomFacility = { name: string; amount: string };
export class Room extends Model { declare id: string; declare room_code: string; declare name: string; declare capacity: number; declare facilities: string | null; declare status: RoomStatus; declare created_at: Date; declare updated_at: Date; }
Room.init({ id, room_code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(150), allowNull: false }, capacity: { type: DataTypes.INTEGER, allowNull: false }, facilities: { type: DataTypes.TEXT, allowNull: true }, status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ACTIVE", validate: { isIn: [["ACTIVE", "INACTIVE"]] } } }, { sequelize, tableName: "room", ...timestamps, indexes: [{ name: "uq_room_code", unique: true, fields: ["room_code"] }, { name: "uq_room_name", unique: true, fields: ["name"] }] });

export class BookingRoom extends Model { declare id: string; declare session_id: string; declare room_id: string; declare booking_name: string | null; declare detail_booking: string | null; declare start_time: string; declare end_time: string; declare created_at: Date; declare updated_at: Date; }
BookingRoom.init({ id, session_id: { type: DataTypes.UUID, allowNull: false }, room_id: { type: DataTypes.UUID, allowNull: false }, booking_name: { type: DataTypes.STRING(150), allowNull: true }, detail_booking: { type: DataTypes.STRING(255), allowNull: true }, start_time: { type: DataTypes.TIME, allowNull: false }, end_time: { type: DataTypes.TIME, allowNull: false } }, { sequelize, tableName: "booking_room", ...timestamps, indexes: [{ name: "ix_booking_room_session_id", fields: ["session_id"] }, { name: "ix_booking_room_room_id", fields: ["room_id"] }] });

export class ClassMaterial extends Model { declare id: string; declare training_id: string; declare material_url: string; declare created_at: Date; declare updated_at: Date; }
ClassMaterial.init({ id, training_id: { type: DataTypes.UUID, allowNull: false }, material_url: { type: DataTypes.STRING(255), allowNull: false } }, { sequelize, tableName: "class_material", ...timestamps, indexes: [{ name: "ix_class_material_training_id", fields: ["training_id"] }] });

export type InvoiceStatus = "DRAFT" | "PUBLISHED" | "PAID" | "CANCELLED";
export class Invoice extends Model { declare id: string; declare account_id: string; declare created_by_subject: string | null; declare sales_subject: string | null; declare bill_to_name: string; declare bill_to_address: string | null; declare description: string | null; declare subtotal: string; declare grand_total: string; declare status: InvoiceStatus; declare due_date: Date | null; declare publish_date: Date | null; declare created_at: Date; declare updated_at: Date; }
Invoice.init({ id, account_id: { type: DataTypes.UUID, allowNull: false }, created_by_subject: { type: DataTypes.STRING(255), allowNull: true }, sales_subject: { type: DataTypes.STRING(255), allowNull: true }, bill_to_name: { type: DataTypes.STRING(150), allowNull: false }, bill_to_address: { type: DataTypes.STRING(255), allowNull: true }, description: { type: DataTypes.STRING(255), allowNull: true }, subtotal: { type: DataTypes.DECIMAL(19, 4), allowNull: false, defaultValue: 0 }, grand_total: { type: DataTypes.DECIMAL(19, 4), allowNull: false, defaultValue: 0 }, status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "DRAFT" }, due_date: { type: DataTypes.DATEONLY, allowNull: true }, publish_date: { type: DataTypes.DATE, allowNull: true } }, { sequelize, tableName: "invoice", ...timestamps, indexes: [{ name: "ix_invoice_account_id", fields: ["account_id"] }] });

export class InvoiceDetail extends Model { declare id: string; declare invoice_id: string; declare training_id: string | null; declare participant_id: string | null; declare description: string; declare quantity: number; declare unit_price: string; declare amount: string; declare created_at: Date; declare updated_at: Date; }
InvoiceDetail.init({ id, invoice_id: { type: DataTypes.UUID, allowNull: false }, training_id: { type: DataTypes.UUID, allowNull: true }, participant_id: { type: DataTypes.UUID, allowNull: true }, description: { type: DataTypes.STRING(255), allowNull: false }, quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }, unit_price: { type: DataTypes.DECIMAL(19, 4), allowNull: false }, amount: { type: DataTypes.DECIMAL(19, 4), allowNull: false } }, { sequelize, tableName: "invoice_detail", ...timestamps, indexes: [{ name: "ix_invoice_detail_invoice_id", fields: ["invoice_id"] }, { name: "ix_invoice_detail_training_id", fields: ["training_id"] }, { name: "ix_invoice_detail_participant_id", fields: ["participant_id"] }] });

export class AuditTrail extends Model {
  declare id: string;
  declare actor_subject: string | null;
  declare actor_name: string | null;
  declare actor_type: string;
  declare active_role: string | null;
  declare process_name: string | null;
  declare action: string;
  declare object_type: string;
  declare object_id: string | null;
  declare ip_address: string | null;
  declare source_service: string;
  declare data_before: string | null;
  declare data_after: string | null;
  declare created_at: Date;
}
AuditTrail.init({
  id,
  actor_subject: { type: DataTypes.STRING(255), allowNull: true },
  actor_name: { type: DataTypes.STRING(255), allowNull: true },
  actor_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "USER" },
  active_role: { type: DataTypes.STRING(50), allowNull: true },
  process_name: { type: DataTypes.STRING(128), allowNull: true },
  action: { type: DataTypes.STRING(50), allowNull: false },
  object_type: { type: DataTypes.STRING(50), allowNull: false },
  object_id: { type: DataTypes.STRING(100), allowNull: true },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  source_service: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "internal-api" },
  data_before: { type: DataTypes.TEXT("long"), allowNull: true },
  data_after: { type: DataTypes.TEXT("long"), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { sequelize, tableName: "audit_trail", timestamps: false, indexes: [
  { name: "ix_audit_trail_actor_created", fields: ["actor_subject", "created_at"] },
  { name: "ix_audit_trail_object", fields: ["object_type", "object_id"] },
  { name: "ix_audit_trail_role_created", fields: ["active_role", "created_at"] },
] });

export class ImportBatch extends Model { declare id: string; declare created_by_subject: string | null; declare filename: string; declare uploaded_at: Date; declare status: string; declare created_at: Date; declare updated_at: Date; }
ImportBatch.init({ id, created_by_subject: { type: DataTypes.STRING(255), allowNull: true }, filename: { type: DataTypes.STRING(255), allowNull: false }, uploaded_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }, status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "PENDING" } }, { sequelize, tableName: "import_batches", ...timestamps });

export class ImportRow extends Model { declare id: string; declare batch_id: string; declare row_number: number; declare raw_data: string; declare validation_status: string; declare error_message: string | null; declare created_at: Date; declare updated_at: Date; }
ImportRow.init({ id, batch_id: { type: DataTypes.UUID, allowNull: false }, row_number: { type: DataTypes.INTEGER, allowNull: false }, raw_data: { type: DataTypes.TEXT("long"), allowNull: false }, validation_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "PENDING" }, error_message: { type: DataTypes.STRING(255), allowNull: true } }, { sequelize, tableName: "import_row", ...timestamps, indexes: [{ name: "uq_import_row_batch_number", unique: true, fields: ["batch_id", "row_number"] }] });

export class ProvisioningLog extends Model { declare id: string; declare batch_id: string | null; declare keycloak_subject: string | null; declare email: string | null; declare target_role: "pic" | "student"; declare status: string; declare sent_at: Date | null; declare error_message: string | null; declare created_at: Date; declare updated_at: Date; }
ProvisioningLog.init({ id, batch_id: { type: DataTypes.UUID, allowNull: true }, keycloak_subject: { type: DataTypes.STRING(255), allowNull: true }, email: { type: DataTypes.STRING(150), allowNull: true }, target_role: { type: DataTypes.STRING(20), allowNull: false }, status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "PENDING" }, sent_at: { type: DataTypes.DATE, allowNull: true }, error_message: { type: DataTypes.STRING(1000), allowNull: true } }, { sequelize, tableName: "provisioning_logs", ...timestamps, indexes: [{ name: "ix_provisioning_logs_batch_id", fields: ["batch_id"] }, { name: "ix_provisioning_logs_status", fields: ["status"] }] });

export class NotificationTemplate extends Model { declare id: string; declare name: string; declare subject_email: string; declare content: string; declare is_active: boolean; declare created_at: Date; declare updated_at: Date; }
NotificationTemplate.init({ id, name: { type: DataTypes.STRING(150), allowNull: false }, subject_email: { type: DataTypes.STRING(150), allowNull: false }, content: { type: DataTypes.TEXT("long"), allowNull: false }, is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true } }, { sequelize, tableName: "notification_template", ...timestamps, indexes: [{ name: "uq_notification_template_name", unique: true, fields: ["name"] }] });

export class NotificationLog extends Model { declare id: string; declare template_id: string | null; declare sent_by_subject: string | null; declare recipient_email: string; declare sent_at: Date | null; declare status: string; declare created_at: Date; declare updated_at: Date; }
NotificationLog.init({ id, template_id: { type: DataTypes.UUID, allowNull: true }, sent_by_subject: { type: DataTypes.STRING(255), allowNull: true }, recipient_email: { type: DataTypes.STRING(150), allowNull: false }, sent_at: { type: DataTypes.DATE, allowNull: true }, status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "PENDING" } }, { sequelize, tableName: "notification_log", ...timestamps, indexes: [{ name: "ix_notification_log_template_id", fields: ["template_id"] }, { name: "ix_notification_log_status", fields: ["status"] }] });

// Same-database Sequelize associations only; subject/student/remote-lab references remain logical.
Industry.hasMany(Account, { foreignKey: "industry_id", as: "accounts" }); Account.belongsTo(Industry, { foreignKey: "industry_id", as: "industry" });
CourseCategory.hasMany(Course, { foreignKey: "category_id", as: "courses" }); Course.belongsTo(CourseCategory, { foreignKey: "category_id", as: "category" });
Course.hasMany(Syllabus, { foreignKey: "course_id", as: "syllabi" }); Syllabus.belongsTo(Course, { foreignKey: "course_id", as: "course" });
Syllabus.hasMany(Training, { foreignKey: "syllabus_id", as: "trainings" }); Training.belongsTo(Syllabus, { foreignKey: "syllabus_id", as: "syllabus" });
Course.hasMany(Training, { foreignKey: "course_id", as: "trainings" }); Training.belongsTo(Course, { foreignKey: "course_id", as: "course" });
Course.hasMany(QuotationOrder, { foreignKey: "course_id", as: "quotationOrders" }); QuotationOrder.belongsTo(Course, { foreignKey: "course_id", as: "course" });
Account.hasMany(Quotation, { foreignKey: "account_id", as: "quotations" }); Quotation.belongsTo(Account, { foreignKey: "account_id", as: "account" });
Quotation.hasMany(QuotationOrder, { foreignKey: "quotation_id", as: "orders" }); QuotationOrder.belongsTo(Quotation, { foreignKey: "quotation_id", as: "quotation" });
Quotation.hasMany(RequestForm, { foreignKey: "quotation_id", as: "requestForms" }); RequestForm.belongsTo(Quotation, { foreignKey: "quotation_id", as: "quotation" });
RequestForm.hasMany(RequestFormCourse, { foreignKey: "request_form_id", as: "courses" }); RequestFormCourse.belongsTo(RequestForm, { foreignKey: "request_form_id", as: "requestForm" });
RequestFormCourse.hasMany(RequestFormSession, { foreignKey: "request_form_course_id", as: "sessions" }); RequestFormSession.belongsTo(RequestFormCourse, { foreignKey: "request_form_course_id", as: "requestFormCourse" });
RequestForm.hasMany(RequestFormAttachment, { foreignKey: "request_form_id", as: "attachments" }); RequestFormAttachment.belongsTo(RequestForm, { foreignKey: "request_form_id", as: "requestForm" });
RequestForm.hasMany(Training, { foreignKey: "request_form_id", as: "trainings" }); Training.belongsTo(RequestForm, { foreignKey: "request_form_id", as: "requestForm" });
Participant.hasMany(Attendance, { foreignKey: "participant_id", as: "attendanceRecords" }); Attendance.belongsTo(Participant, { foreignKey: "participant_id", as: "participant" });
TrainingSession.hasMany(Attendance, { foreignKey: "session_id", as: "attendanceRecords" }); Attendance.belongsTo(TrainingSession, { foreignKey: "session_id", as: "session" });
Participant.hasMany(Evaluation, { foreignKey: "participant_id", as: "evaluations" }); Evaluation.belongsTo(Participant, { foreignKey: "participant_id", as: "participant" });
Training.hasMany(Evaluation, { foreignKey: "training_id", as: "evaluations" }); Evaluation.belongsTo(Training, { foreignKey: "training_id", as: "training" });
CertificateTemplate.hasMany(Certificate, { foreignKey: "template_id", as: "certificates" }); Certificate.belongsTo(CertificateTemplate, { foreignKey: "template_id", as: "template" });
Training.hasMany(Certificate, { foreignKey: "training_id", as: "certificates" }); Certificate.belongsTo(Training, { foreignKey: "training_id", as: "training" });
Participant.hasMany(Certificate, { foreignKey: "participant_id", as: "certificates" }); Certificate.belongsTo(Participant, { foreignKey: "participant_id", as: "participant" });
Room.hasMany(BookingRoom, { foreignKey: "room_id", as: "bookings" }); BookingRoom.belongsTo(Room, { foreignKey: "room_id", as: "room" });
TrainingSession.hasMany(BookingRoom, { foreignKey: "session_id", as: "roomBookings" }); BookingRoom.belongsTo(TrainingSession, { foreignKey: "session_id", as: "session" });
Training.hasMany(ClassMaterial, { foreignKey: "training_id", as: "materials" }); ClassMaterial.belongsTo(Training, { foreignKey: "training_id", as: "training" });
Account.hasMany(Invoice, { foreignKey: "account_id", as: "invoices" }); Invoice.belongsTo(Account, { foreignKey: "account_id", as: "account" });
Invoice.hasMany(InvoiceDetail, { foreignKey: "invoice_id", as: "details" }); InvoiceDetail.belongsTo(Invoice, { foreignKey: "invoice_id", as: "invoice" });
Training.hasMany(InvoiceDetail, { foreignKey: "training_id", as: "invoiceDetails" }); InvoiceDetail.belongsTo(Training, { foreignKey: "training_id", as: "training" });
Participant.hasMany(InvoiceDetail, { foreignKey: "participant_id", as: "invoiceDetails" }); InvoiceDetail.belongsTo(Participant, { foreignKey: "participant_id", as: "participant" });
ImportBatch.hasMany(ImportRow, { foreignKey: "batch_id", as: "rows" }); ImportRow.belongsTo(ImportBatch, { foreignKey: "batch_id", as: "batch" });
ImportBatch.hasMany(ProvisioningLog, { foreignKey: "batch_id", as: "provisioningLogs" }); ProvisioningLog.belongsTo(ImportBatch, { foreignKey: "batch_id", as: "batch" });
NotificationTemplate.hasMany(NotificationLog, { foreignKey: "template_id", as: "logs" }); NotificationLog.belongsTo(NotificationTemplate, { foreignKey: "template_id", as: "template" });
