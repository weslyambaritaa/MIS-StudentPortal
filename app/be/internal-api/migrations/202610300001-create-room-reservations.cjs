"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("room_reservation", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      room_id: { type: Sequelize.UUID, allowNull: false, references: { model: "room", key: "id" }, onUpdate: "CASCADE", onDelete: "NO ACTION" },
      booking_date: { type: Sequelize.DATEONLY, allowNull: false },
      start_time: { type: Sequelize.TIME, allowNull: false },
      end_time: { type: Sequelize.TIME, allowNull: false },
      reason: { type: Sequelize.STRING(20), allowNull: false },
      reason_detail: { type: Sequelize.STRING(255), allowNull: true },
      detail_booking: { type: Sequelize.STRING(1000), allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "BOOKED" },
      created_by_subject: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
    await queryInterface.sequelize.query("ALTER TABLE room_reservation ADD CONSTRAINT ck_room_reservation_reason CHECK (reason IN ('MEETING', 'EVENTS', 'WORKSHOP', 'OTHERS'))");
    await queryInterface.sequelize.query("ALTER TABLE room_reservation ADD CONSTRAINT ck_room_reservation_status CHECK (status IN ('BOOKED', 'CANCELLED'))");
    await queryInterface.sequelize.query("ALTER TABLE room_reservation ADD CONSTRAINT ck_room_reservation_time CHECK (end_time > start_time)");
    await queryInterface.addIndex("room_reservation", ["room_id", "booking_date", "status"], { name: "ix_room_reservation_schedule" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("room_reservation");
  },
};
