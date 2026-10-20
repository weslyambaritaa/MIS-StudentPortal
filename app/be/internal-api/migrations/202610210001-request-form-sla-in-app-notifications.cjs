"use strict";

const nationalHolidays = [
  ["2026-01-01", "New Year's Day"], ["2026-01-16", "Isra Mikraj"], ["2026-02-17", "Lunar New Year"],
  ["2026-03-19", "Nyepi"], ["2026-03-21", "Eid al-Fitr"], ["2026-03-22", "Eid al-Fitr"],
  ["2026-04-03", "Good Friday"], ["2026-04-05", "Easter"], ["2026-05-01", "International Labour Day"],
  ["2026-05-14", "Ascension Day"], ["2026-05-27", "Eid al-Adha"], ["2026-05-31", "Vesak Day"],
  ["2026-06-01", "Pancasila Day"], ["2026-06-16", "Islamic New Year"], ["2026-08-17", "Independence Day"],
  ["2026-08-25", "Prophet Muhammad's Birthday"], ["2026-12-25", "Christmas Day"],
  ["2027-01-01", "New Year's Day"], ["2027-01-05", "Isra Mikraj"], ["2027-02-06", "Lunar New Year"],
  ["2027-03-08", "Nyepi"], ["2027-03-10", "Eid al-Fitr"], ["2027-03-11", "Eid al-Fitr"],
  ["2027-03-26", "Good Friday"], ["2027-03-28", "Easter"], ["2027-05-01", "International Labour Day"],
  ["2027-05-06", "Ascension Day"], ["2027-05-17", "Eid al-Adha"], ["2027-05-20", "Vesak Day"],
  ["2027-06-01", "Pancasila Day"], ["2027-06-06", "Islamic New Year"], ["2027-08-15", "Prophet Muhammad's Birthday"],
  ["2027-08-17", "Independence Day"], ["2027-12-25", "Christmas Day"], ["2027-12-26", "Isra Mikraj"],
];

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.addColumn("request_form", "sla_due_at", { type: S.DATE, allowNull: true }, { transaction });
      await qi.addColumn("request_form", "sla_notified_at", { type: S.DATE, allowNull: true }, { transaction });
      await qi.addIndex("request_form", ["status", "sla_due_at", "sla_notified_at"], { name: "ix_request_form_sla_pending", transaction });
      await qi.createTable("business_calendar_holiday", {
        holiday_date: { type: S.DATEONLY, primaryKey: true, allowNull: false },
        name: { type: S.STRING(150), allowNull: false },
      }, { transaction });
      await qi.bulkInsert("business_calendar_holiday", nationalHolidays.map(([holiday_date, name]) => ({ holiday_date, name })), { transaction });
      await qi.createTable("in_app_notification", {
        id: { type: S.UUID, primaryKey: true, allowNull: false },
        recipient_subject: { type: S.STRING(255), allowNull: false },
        event_key: { type: S.STRING(255), allowNull: false },
        title: { type: S.STRING(150), allowNull: false },
        message: { type: S.STRING(500), allowNull: false },
        target_path: { type: S.STRING(255), allowNull: false },
        created_at: { type: S.DATE, allowNull: false, defaultValue: S.literal("GETUTCDATE()") },
        read_at: { type: S.DATE, allowNull: true },
      }, { transaction });
      await qi.addIndex("in_app_notification", ["recipient_subject", "event_key"], { name: "uq_in_app_notification_recipient_event", unique: true, transaction });
      await qi.addIndex("in_app_notification", ["recipient_subject", "created_at"], { name: "ix_in_app_notification_recipient_created", transaction });
    });
  },

  async down(qi) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.dropTable("in_app_notification", { transaction });
      await qi.dropTable("business_calendar_holiday", { transaction });
      await qi.removeIndex("request_form", "ix_request_form_sla_pending", { transaction });
      await qi.removeColumn("request_form", "sla_notified_at", { transaction });
      await qi.removeColumn("request_form", "sla_due_at", { transaction });
    });
  },
};
