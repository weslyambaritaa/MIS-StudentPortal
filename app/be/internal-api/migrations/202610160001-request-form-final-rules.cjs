"use strict";

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.sequelize.query(
        "ALTER TABLE request_form DROP CONSTRAINT ck_request_form_status",
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE request_form ADD CONSTRAINT ck_request_form_status CHECK (status IN ('DRAFT','WAITING','REVISION','APPROVED'))",
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE request_form_course DROP CONSTRAINT ck_request_form_course_delivery_type",
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE request_form_course ADD CONSTRAINT ck_request_form_course_delivery_type CHECK (delivery_type IN ('PUBLIC','PRIVATE','INHOUSE','ONLINE_PUBLIC','ONLINE_PRIVATE'))",
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE request_form_course ALTER COLUMN room_rental DROP NOT NULL",
        { transaction },
      );
    });
  },

  async down(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.sequelize.query(
        "UPDATE request_form SET status='WAITING' WHERE status='APPROVED'",
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE request_form DROP CONSTRAINT ck_request_form_status",
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE request_form ADD CONSTRAINT ck_request_form_status CHECK (status IN ('DRAFT','WAITING','REVISION'))",
        { transaction },
      );
      await qi.sequelize.query(
        "UPDATE request_form_course SET delivery_type='ONLINE' WHERE delivery_type IN ('ONLINE_PUBLIC','ONLINE_PRIVATE')",
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE request_form_course DROP CONSTRAINT ck_request_form_course_delivery_type",
        { transaction },
      );
      await qi.sequelize.query(
        "ALTER TABLE request_form_course ADD CONSTRAINT ck_request_form_course_delivery_type CHECK (delivery_type IN ('PUBLIC','PRIVATE','INHOUSE','ONLINE'))",
        { transaction },
      );
      await qi.sequelize.query(
        "UPDATE request_form_course SET room_rental=false WHERE room_rental IS NULL",
        { transaction },
      );
      await qi.changeColumn("request_form_course", "room_rental", {
        type: S.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }, { transaction });
    });
  },
};
