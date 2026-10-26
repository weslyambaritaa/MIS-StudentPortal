"use strict";

module.exports = {
  async up(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.addColumn("request_form_course", "location_type", { type: S.STRING(20), allowNull: false, defaultValue: "INTERNAL" }, { transaction });
      await qi.addColumn("request_form_course", "location_name", { type: S.STRING(150), allowNull: true }, { transaction });
      await qi.addColumn("request_form_course", "location_address", { type: S.STRING(500), allowNull: true }, { transaction });
      await qi.sequelize.query("UPDATE request_form_course SET location_type=CASE WHEN delivery_type='INHOUSE' THEN 'CLIENT' WHEN delivery_type IN ('ONLINE','ONLINE_PUBLIC','ONLINE_PRIVATE') THEN 'ONLINE' ELSE 'INTERNAL' END", { transaction });
      await qi.sequelize.query("ALTER TABLE request_form_course ADD CONSTRAINT ck_request_form_course_location_type CHECK (location_type IN ('INTERNAL','CLIENT','ONLINE'))", { transaction });
      await qi.addColumn("training", "base_fee", { type: S.DECIMAL(19, 4), allowNull: true }, { transaction });
      await qi.changeColumn("training", "name", { type: S.STRING(255), allowNull: false }, { transaction });
      await qi.sequelize.query("ALTER TABLE training DROP CONSTRAINT ck_training_type", { transaction });
      await qi.sequelize.query("ALTER TABLE training ADD CONSTRAINT ck_training_type CHECK (training_type IN ('PUBLIC','PRIVATE','INHOUSE','ONLINE_PUBLIC','ONLINE_PRIVATE'))", { transaction });
    });
  },

  async down(qi, S) {
    await qi.sequelize.transaction(async (transaction) => {
      await qi.sequelize.query("UPDATE training SET training_type=CASE WHEN training_type IN ('INHOUSE','ONLINE_PRIVATE') THEN 'PRIVATE' WHEN training_type='ONLINE_PUBLIC' THEN 'PUBLIC' ELSE training_type END WHERE training_type IN ('INHOUSE','ONLINE_PRIVATE','ONLINE_PUBLIC')", { transaction });
      await qi.sequelize.query("ALTER TABLE training DROP CONSTRAINT ck_training_type", { transaction });
      await qi.sequelize.query("ALTER TABLE training ADD CONSTRAINT ck_training_type CHECK (training_type IN ('PUBLIC','PRIVATE'))", { transaction });
      await qi.changeColumn("training", "name", { type: S.STRING(200), allowNull: false }, { transaction });
      await qi.removeColumn("training", "base_fee", { transaction });
      await qi.sequelize.query("ALTER TABLE request_form_course DROP CONSTRAINT ck_request_form_course_location_type", { transaction });
      for (const column of ["location_address", "location_name", "location_type"]) await qi.removeColumn("request_form_course", column, { transaction });
    });
  },
};
