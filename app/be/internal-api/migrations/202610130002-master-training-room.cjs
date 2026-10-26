"use strict";

const roles = ["student", "pic", "trainer", "sales", "admin", "finance", "management"];
const matrixIds = roles.map((_, index) => `62190000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.addColumn("room", "room_code", { type: S.STRING(20), allowNull: true }, { transaction });
      await qi.changeColumn("room", "facilities", { type: S.TEXT, allowNull: true }, { transaction });
      await qi.sequelize.query(`
        WITH numbered AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS sequence_number
          FROM room
        )
        UPDATE room AS room
           SET room_code = 'TR-' || LPAD(numbered.sequence_number::text, 2, '0')
          FROM numbered
         WHERE numbered.id = room.id
      `, { transaction });
      await qi.changeColumn("room", "room_code", { type: S.STRING(20), allowNull: false }, { transaction });
      await qi.sequelize.query("ALTER TABLE room DROP CONSTRAINT ck_room_status", { transaction });
      await qi.sequelize.query("UPDATE room SET status = CASE WHEN status = 'AVAILABLE' THEN 'ACTIVE' ELSE 'INACTIVE' END", { transaction });
      await qi.sequelize.query("ALTER TABLE room ADD CONSTRAINT ck_room_status CHECK (status IN ('ACTIVE','INACTIVE'))", { transaction });
      await qi.sequelize.query("CREATE UNIQUE INDEX uq_room_code ON room (room_code)", { transaction });
      const [rows] = await qi.sequelize.query("SELECT COALESCE(MAX(NULLIF(SUBSTRING(room_code FROM 4), '')::BIGINT), 0) + 1 AS next_value FROM room", { transaction });
      // TR-01 is also used by the development seed when the database is empty.
      const nextValue = Math.max(2, Number(rows[0]?.next_value ?? 1));
      await qi.sequelize.query(`CREATE SEQUENCE room_code_seq START WITH ${nextValue} INCREMENT BY 1`, { transaction });
      await qi.bulkInsert("role_access_matrix", roles.map((role, index) => ({
        id: matrixIds[index], role, resource_group: "ROOM",
        can_view: role === "admin", can_create: role === "admin", can_edit: role === "admin", can_delete: role === "admin",
        created_at: new Date(), updated_at: new Date(),
      })), { transaction });
    });
  },

  async down(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.bulkDelete("role_access_matrix", { id: matrixIds }, { transaction });
      await qi.sequelize.query("DROP SEQUENCE room_code_seq", { transaction });
      await qi.sequelize.query("DROP INDEX uq_room_code", { transaction });
      await qi.sequelize.query("ALTER TABLE room DROP CONSTRAINT ck_room_status", { transaction });
      await qi.sequelize.query("UPDATE room SET status = CASE WHEN status = 'ACTIVE' THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END", { transaction });
      await qi.sequelize.query("ALTER TABLE room ADD CONSTRAINT ck_room_status CHECK (status IN ('AVAILABLE','UNAVAILABLE','MAINTENANCE'))", { transaction });
      await qi.changeColumn("room", "facilities", { type: S.STRING(255), allowNull: true }, { transaction });
      await qi.removeColumn("room", "room_code", { transaction });
    });
  },
};
