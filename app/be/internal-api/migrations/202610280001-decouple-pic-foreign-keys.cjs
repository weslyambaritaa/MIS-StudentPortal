"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE constraint_row RECORD;
      BEGIN
        FOR constraint_row IN
          SELECT conrelid::regclass AS table_name, conname
          FROM pg_constraint
          WHERE contype = 'f'
            AND (
              (confrelid = to_regclass('public.pic_profile')
                AND conrelid IN (to_regclass('public.request_form'), to_regclass('public.training')))
              OR (conrelid = to_regclass('public.pic_account_assignment')
                AND confrelid = to_regclass('public.account'))
            )
        LOOP
          EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', constraint_row.table_name, constraint_row.conname);
        END LOOP;
      END $$;
    `);
  },

  async down() {
    throw new Error("PIC UUIDs now refer to Student API data and cannot safely be reattached to the legacy Internal PIC table.");
  },
};
