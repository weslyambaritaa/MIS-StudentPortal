"use strict";

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.sequelize.query(
        "ALTER TABLE request_form_session DROP CONSTRAINT ck_request_form_session_time",
        { transaction },
      );
      await qi.changeColumn("request_form_session", "start_time", {
        type: S.TIME,
        allowNull: true,
      }, { transaction });
      await qi.changeColumn("request_form_session", "end_time", {
        type: S.TIME,
        allowNull: true,
      }, { transaction });
    });
  },

  async down(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.sequelize.query(
        "UPDATE request_form_session SET start_time='09:00:00', end_time='17:00:00' WHERE start_time IS NULL OR end_time IS NULL",
        { transaction },
      );
      await qi.changeColumn("request_form_session", "start_time", {
        type: S.TIME,
        allowNull: false,
      }, { transaction });
      await qi.changeColumn("request_form_session", "end_time", {
        type: S.TIME,
        allowNull: false,
      }, { transaction });
      await qi.sequelize.query(
        "ALTER TABLE request_form_session ADD CONSTRAINT ck_request_form_session_time CHECK (end_time > start_time)",
        { transaction },
      );
    });
  },
};
