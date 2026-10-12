"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn("industry", "industry_code", {
        type: Sequelize.STRING(20),
        allowNull: true,
        transaction,
      });

      const [rows] = await queryInterface.sequelize.query(
        "SELECT COUNT_BIG(1) AS [count] FROM [dbo].[industry]",
        { transaction },
      );
      const startAt = Number(rows[0]?.count ?? 0) + 1;
      await queryInterface.sequelize.query(
        `WITH numbered AS (
           SELECT [id], ROW_NUMBER() OVER (ORDER BY [created_at], [id]) AS [n]
           FROM [dbo].[industry]
         )
         UPDATE i SET [industry_code] = 'IND-' + RIGHT('00' + CAST(numbered.[n] AS VARCHAR(18)), 2)
         FROM [dbo].[industry] AS i JOIN numbered ON numbered.[id] = i.[id]`,
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
        `CREATE SEQUENCE [dbo].[industry_code_seq] AS BIGINT START WITH ${startAt} INCREMENT BY 1;`,
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
        assigned_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("SYSUTCDATETIME()") },
      }, { transaction });
      await queryInterface.addIndex("account_industry_history", ["industry_id"], { name: "ix_account_industry_history_industry", transaction });
      await queryInterface.addIndex("account_industry_history", ["account_id", "assigned_at"], { name: "ix_account_industry_history_account", transaction });
      await queryInterface.sequelize.query(
        `INSERT INTO [dbo].[account_industry_history] ([id], [account_id], [industry_id], [assigned_at])
         SELECT NEWID(), [id], [industry_id], [updated_at]
         FROM [dbo].[account]
         WHERE [industry_id] IS NOT NULL`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE TRIGGER [dbo].[tr_account_industry_history]
         ON [dbo].[account]
         AFTER INSERT, UPDATE
         AS
         BEGIN
           SET NOCOUNT ON;
           INSERT INTO [dbo].[account_industry_history] ([id], [account_id], [industry_id], [assigned_at])
           SELECT NEWID(), i.[id], i.[industry_id], SYSUTCDATETIME()
           FROM inserted AS i
           LEFT JOIN deleted AS d ON d.[id] = i.[id]
           WHERE i.[industry_id] IS NOT NULL
             AND (d.[id] IS NULL OR d.[industry_id] IS NULL OR d.[industry_id] <> i.[industry_id]);
         END;`,
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT TOP (1) [id] FROM [dbo].[account_industry_history]",
    );
    if (rows.length) throw new Error("Refusing to remove Industry usage history or generated codes after use");
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query("DROP TRIGGER [dbo].[tr_account_industry_history]", { transaction });
      await queryInterface.dropTable("account_industry_history", { transaction });
      await queryInterface.removeIndex("industry", "uq_industry_code", { transaction });
      await queryInterface.sequelize.query("DROP SEQUENCE [dbo].[industry_code_seq]", { transaction });
      await queryInterface.removeColumn("industry", "industry_code", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
