"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const industryColumns = await queryInterface.describeTable("industry", { transaction });
      if (!industryColumns.industry_code) {
        await queryInterface.addColumn("industry", "industry_code", {
          type: Sequelize.STRING(20),
          allowNull: true,
        }, { transaction });
      }

      const [rows] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS count FROM industry",
        { transaction },
      );
      const startAt = Number(rows[0]?.count ?? 0) + 1;
      await queryInterface.sequelize.query(
        `WITH numbered AS (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS n FROM industry)
         UPDATE industry AS i SET industry_code = 'IND-' || LPAD(numbered.n::text, 2, '0')
         FROM numbered WHERE numbered.id = i.id`,
        { transaction },
      );
      await queryInterface.changeColumn("industry", "industry_code", {
        type: Sequelize.STRING(20),
        allowNull: false,
      }, { transaction });
      await queryInterface.addIndex("industry", ["industry_code"], {
        name: "uq_industry_code",
        unique: true,
        transaction,
      });
      await queryInterface.sequelize.query(
        `CREATE SEQUENCE industry_code_seq START WITH ${startAt} INCREMENT BY 1`,
        { transaction },
      );

      await queryInterface.createTable("account_industry_history", {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
        account_id: { type: Sequelize.UUID, allowNull: false },
        industry_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "industry", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "NO ACTION",
        },
        assigned_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      }, { transaction });
      await queryInterface.addIndex("account_industry_history", ["industry_id"], { name: "ix_account_industry_history_industry", transaction });
      await queryInterface.addIndex("account_industry_history", ["account_id", "assigned_at"], { name: "ix_account_industry_history_account", transaction });
      await queryInterface.sequelize.query(
        `INSERT INTO account_industry_history (id, account_id, industry_id, assigned_at)
         SELECT gen_random_uuid(), id, industry_id, updated_at FROM account WHERE industry_id IS NOT NULL`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE OR REPLACE FUNCTION record_account_industry_history() RETURNS trigger AS $$
         BEGIN
           IF TG_OP = 'INSERT' OR NEW.industry_id IS DISTINCT FROM OLD.industry_id THEN
             IF NEW.industry_id IS NOT NULL THEN
               INSERT INTO account_industry_history (id, account_id, industry_id, assigned_at)
               VALUES (gen_random_uuid(), NEW.id, NEW.industry_id, CURRENT_TIMESTAMP);
             END IF;
           END IF;
           RETURN NEW;
         END;
         $$ LANGUAGE plpgsql`,
        { transaction },
      );
      await queryInterface.sequelize.query("CREATE TRIGGER tr_account_industry_history AFTER INSERT OR UPDATE OF industry_id ON account FOR EACH ROW EXECUTE FUNCTION record_account_industry_history()", { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM account_industry_history LIMIT 1",
    );
    if (rows.length) throw new Error("Refusing to remove Industry usage history or generated codes after use");
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query("DROP TRIGGER tr_account_industry_history ON account", { transaction });
      await queryInterface.sequelize.query("DROP FUNCTION record_account_industry_history()", { transaction });
      await queryInterface.dropTable("account_industry_history", { transaction });
      await queryInterface.removeIndex("industry", "uq_industry_code", { transaction });
      await queryInterface.sequelize.query("DROP SEQUENCE industry_code_seq", { transaction });
      await queryInterface.removeColumn("industry", "industry_code", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
