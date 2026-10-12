"use strict";

const PERSONAL_CODE = "IND-PERSONAL";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn("account", "account_code", { type: Sequelize.STRING(20), allowNull: true }, { transaction });
      await queryInterface.addColumn("account", "personal_student_subject", { type: Sequelize.STRING(255), allowNull: true }, { transaction });
      await queryInterface.addColumn("participant", "student_subject", { type: Sequelize.STRING(255), allowNull: true }, { transaction });

      const [personalRows] = await queryInterface.sequelize.query(
        "SELECT [id], [industry_code], [status] FROM [dbo].[industry] WHERE LOWER(LTRIM(RTRIM([name]))) = 'personal'",
        { transaction },
      );
      if (personalRows.length > 1) throw new Error("Multiple Industry rows named Personal exist; reconcile them before ST-11 migration");
      let personalIndustryId = personalRows[0]?.id;
      if (!personalIndustryId) {
        const [codeRows] = await queryInterface.sequelize.query(
          "SELECT TOP (1) [id] FROM [dbo].[industry] WHERE [industry_code] = :code",
          { replacements: { code: PERSONAL_CODE }, transaction },
        );
        if (codeRows.length) throw new Error("IND-PERSONAL code is already used by a non-Personal Industry");
        await queryInterface.sequelize.query(
          "INSERT INTO [dbo].[industry] ([id], [industry_code], [name], [status], [created_at], [updated_at]) VALUES (NEWID(), :code, 'Personal', 'ACTIVE', SYSUTCDATETIME(), SYSUTCDATETIME())",
          { replacements: { code: PERSONAL_CODE }, transaction },
        );
        const [createdRows] = await queryInterface.sequelize.query(
          "SELECT [id] FROM [dbo].[industry] WHERE [industry_code] = :code",
          { replacements: { code: PERSONAL_CODE }, transaction },
        );
        personalIndustryId = createdRows[0].id;
      } else {
        if (personalRows[0].industry_code !== PERSONAL_CODE) {
          const [reservedRows] = await queryInterface.sequelize.query(
            "SELECT TOP (1) [id] FROM [dbo].[industry] WHERE [industry_code] = :code",
            { replacements: { code: PERSONAL_CODE }, transaction },
          );
          if (reservedRows.length) throw new Error("IND-PERSONAL code belongs to another Industry; reconcile before migration");
          await queryInterface.sequelize.query(
            "UPDATE [dbo].[industry] SET [industry_code] = :code WHERE [id] = :id",
            { replacements: { code: PERSONAL_CODE, id: personalIndustryId }, transaction },
          );
        }
        await queryInterface.sequelize.query(
          "UPDATE [dbo].[industry] SET [status] = 'ACTIVE', [updated_at] = SYSUTCDATETIME() WHERE [id] = :id",
          { replacements: { id: personalIndustryId }, transaction },
        );
      }

      // Existing PERSONAL Accounts can be mapped unambiguously from their existing type.
      await queryInterface.sequelize.query(
        "UPDATE [dbo].[account] SET [industry_id] = :industryId WHERE [account_type] = 'PERSONAL' AND [industry_id] IS NULL",
        { replacements: { industryId: personalIndustryId }, transaction },
      );
      const [unmappedAccounts] = await queryInterface.sequelize.query(
        "SELECT COUNT_BIG(1) AS [count] FROM [dbo].[account] WHERE [industry_id] IS NULL",
        { transaction },
      );
      if (Number(unmappedAccounts[0]?.count ?? 0) > 0) {
        throw new Error("Some existing Corporate Accounts have no Industry. Map them to the correct Industry before rerunning the ST-11 migration; no Industry was guessed.");
      }
      const [inconsistentTypes] = await queryInterface.sequelize.query(
        `SELECT COUNT_BIG(1) AS [count] FROM [dbo].[account] a JOIN [dbo].[industry] i ON i.[id] = a.[industry_id]
         WHERE (a.[account_type] = 'PERSONAL' AND i.[industry_code] <> :personalCode)
            OR (a.[account_type] = 'CORPORATE' AND i.[industry_code] = :personalCode)`,
        { replacements: { personalCode: PERSONAL_CODE }, transaction },
      );
      if (Number(inconsistentTypes[0]?.count ?? 0) > 0) {
        throw new Error("Existing Account type does not match its Industry. Reconcile those records before rerunning the ST-11 migration.");
      }
      // SQL Server will not alter nullability while the existing nonclustered
      // index depends on this column. Drop/recreate that index in this migration.
      await queryInterface.removeIndex("account", "ix_account_industry_id", { transaction });
      await queryInterface.changeColumn("account", "industry_id", { type: Sequelize.UUID, allowNull: false }, { transaction });
      await queryInterface.addIndex("account", ["industry_id"], { name: "ix_account_industry_id", transaction });
      await queryInterface.sequelize.query(
        "ALTER TABLE [dbo].[account] ADD CONSTRAINT [ck_account_personal_student_type] CHECK ([personal_student_subject] IS NULL OR [account_type] = 'PERSONAL')",
        { transaction },
      );

      const [countRows] = await queryInterface.sequelize.query("SELECT COUNT_BIG(1) AS [count] FROM [dbo].[account]", { transaction });
      const nextCode = Number(countRows[0]?.count ?? 0) + 1;
      await queryInterface.sequelize.query(
        `WITH numbered AS (SELECT [id], ROW_NUMBER() OVER (ORDER BY [created_at], [id]) AS [n] FROM [dbo].[account])
         UPDATE a SET [account_code] = 'ACC-' + RIGHT('000000' + CAST(numbered.[n] AS VARCHAR(18)), 6)
         FROM [dbo].[account] a JOIN numbered ON numbered.[id] = a.[id]`,
        { transaction },
      );
      await queryInterface.changeColumn("account", "account_code", { type: Sequelize.STRING(20), allowNull: false }, { transaction });
      await queryInterface.addIndex("account", ["account_code"], { name: "uq_account_account_code", unique: true, transaction });
      await queryInterface.addIndex("account", ["personal_student_subject"], {
        name: "uq_account_personal_student_subject", unique: true,
        where: { personal_student_subject: { [Sequelize.Op.ne]: null } }, transaction,
      });
      await queryInterface.addIndex("participant", ["student_subject"], { name: "ix_participant_student_subject", transaction });
      await queryInterface.sequelize.query(`CREATE SEQUENCE [dbo].[account_code_seq] AS BIGINT START WITH ${nextCode} INCREMENT BY 1;`, { transaction });

      // Database-level guard protects Training writes regardless of which future route performs them.
      await queryInterface.sequelize.query(
        `CREATE TRIGGER [dbo].[tr_training_requires_active_account]
         ON [dbo].[training] AFTER INSERT, UPDATE AS
         BEGIN
           SET NOCOUNT ON;
           IF EXISTS (SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.[id] = i.[id]
                      JOIN [dbo].[account] a ON a.[id] = i.[account_id]
                      WHERE a.[status] <> 'ACTIVE' AND (d.[id] IS NULL OR d.[account_id] <> i.[account_id]))
           BEGIN
             THROW 51011, 'Training cannot be created or moved to an inactive Account.', 1;
           END;
         END;`, { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE TRIGGER [dbo].[tr_personal_industry_must_remain_active]
         ON [dbo].[industry] AFTER UPDATE AS
         BEGIN
           SET NOCOUNT ON;
           IF EXISTS (SELECT 1 FROM inserted WHERE [industry_code] = '${PERSONAL_CODE}' AND [status] <> 'ACTIVE')
           BEGIN
             THROW 51012, 'The Personal Industry must remain active.', 1;
           END;
         END;`, { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE TRIGGER [dbo].[tr_personal_industry_cannot_be_deleted]
         ON [dbo].[industry] INSTEAD OF DELETE AS
         BEGIN
           SET NOCOUNT ON;
           IF EXISTS (SELECT 1 FROM deleted WHERE [industry_code] = '${PERSONAL_CODE}')
           BEGIN
             THROW 51014, 'The system Personal Industry cannot be deleted.', 1;
           END;
           DELETE i FROM [dbo].[industry] i JOIN deleted d ON d.[id] = i.[id];
         END;`, { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE TRIGGER [dbo].[tr_account_code_immutable]
         ON [dbo].[account] AFTER UPDATE AS
         BEGIN
           SET NOCOUNT ON;
           IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.[id] = i.[id] WHERE i.[account_code] <> d.[account_code])
           BEGIN
             THROW 51013, 'Account Code is generated and cannot be changed.', 1;
           END;
         END;`, { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE TRIGGER [dbo].[tr_account_type_matches_industry]
         ON [dbo].[account] AFTER INSERT, UPDATE AS
         BEGIN
           SET NOCOUNT ON;
           IF EXISTS (SELECT 1 FROM inserted a JOIN [dbo].[industry] i ON i.[id] = a.[industry_id]
                      WHERE (a.[account_type] = 'PERSONAL' AND i.[industry_code] <> '${PERSONAL_CODE}')
                         OR (a.[account_type] = 'CORPORATE' AND i.[industry_code] = '${PERSONAL_CODE}'))
           BEGIN
             THROW 51015, 'Account type must match the selected Industry.', 1;
           END;
         END;`, { transaction },
      );

      // ST-11 business authorization: Sales CRUD; Admin can view and link Student identity only.
      const grants = [
        { role: "sales", can_view: true, can_create: true, can_edit: true, can_delete: true },
        { role: "admin", can_view: true, can_create: false, can_edit: true, can_delete: false },
      ];
      for (const grant of grants) {
        const [existing] = await queryInterface.sequelize.query(
          "SELECT TOP (1) [id], [can_view], [can_create], [can_edit], [can_delete] FROM [dbo].[role_access_matrix] WHERE [role] = :role AND [resource_group] = 'ACCOUNT'",
          { replacements: { role: grant.role }, transaction },
        );
        const before = existing.length ? {
          can_view: Boolean(existing[0].can_view), can_create: Boolean(existing[0].can_create),
          can_edit: Boolean(existing[0].can_edit), can_delete: Boolean(existing[0].can_delete),
        } : null;
        const after = { can_view: grant.can_view, can_create: grant.can_create, can_edit: grant.can_edit, can_delete: grant.can_delete };
        if (before && Object.keys(after).every((key) => before[key] === after[key])) continue;
        if (existing.length) {
          await queryInterface.sequelize.query(
            "UPDATE [dbo].[role_access_matrix] SET [can_view] = :can_view, [can_create] = :can_create, [can_edit] = :can_edit, [can_delete] = :can_delete, [updated_at] = SYSUTCDATETIME() WHERE [id] = :id",
            { replacements: { ...after, id: existing[0].id }, transaction },
          );
        } else {
          await queryInterface.sequelize.query(
            "INSERT INTO [dbo].[role_access_matrix] ([id], [role], [resource_group], [can_view], [can_create], [can_edit], [can_delete], [created_at], [updated_at]) VALUES (NEWID(), :role, 'ACCOUNT', :can_view, :can_create, :can_edit, :can_delete, SYSUTCDATETIME(), SYSUTCDATETIME())",
            { replacements: { role: grant.role, ...after }, transaction },
          );
        }
        await queryInterface.sequelize.query(
          "INSERT INTO [dbo].[audit_trail] ([id], [actor_subject], [actor_name], [actor_type], [active_role], [process_name], [action], [object_type], [object_id], [source_service], [data_before], [data_after], [created_at]) VALUES (NEWID(), 'SYSTEM:ST11_MIGRATION', 'ST-11 migration', 'SYSTEM', NULL, 'st11-account-capability-grant', 'UPDATE', 'ROLE_ACCESS_MATRIX', :objectId, 'internal-api', :before, :after, SYSUTCDATETIME())",
          { replacements: { objectId: `ACCOUNT:${grant.role}`, before: before ? JSON.stringify(before) : null, after: JSON.stringify(after) }, transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      // Keep the original SQL/DDL error: on SQL Server, the server may already
      // have aborted the transaction, in which case rollback itself throws and
      // otherwise hides the migration's actual failure.
      if (!transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          error.rollbackError = rollbackError;
        }
      }
      throw error;
    }
  },

  async down() {
    throw new Error("ST-11 Account foundation is intentionally forward-only: generated Account Codes, Personal Student links, Industry mapping, and access grants must not be discarded by rollback.");
  },
};
