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
        "SELECT id, industry_code, status FROM industry WHERE LOWER(BTRIM(name)) = 'personal'",
        { transaction },
      );
      if (personalRows.length > 1) throw new Error("Multiple Industry rows named Personal exist; reconcile them before ST-11 migration");
      let personalIndustryId = personalRows[0]?.id;
      if (!personalIndustryId) {
        const [codeRows] = await queryInterface.sequelize.query(
          "SELECT id FROM industry WHERE industry_code = :code LIMIT 1",
          { replacements: { code: PERSONAL_CODE }, transaction },
        );
        if (codeRows.length) throw new Error("IND-PERSONAL code is already used by a non-Personal Industry");
        await queryInterface.sequelize.query(
          "INSERT INTO industry (id, industry_code, name, status, created_at, updated_at) VALUES (gen_random_uuid(), :code, 'Personal', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          { replacements: { code: PERSONAL_CODE }, transaction },
        );
        const [createdRows] = await queryInterface.sequelize.query(
          "SELECT id FROM industry WHERE industry_code = :code",
          { replacements: { code: PERSONAL_CODE }, transaction },
        );
        personalIndustryId = createdRows[0].id;
      } else {
        if (personalRows[0].industry_code !== PERSONAL_CODE) {
          const [reservedRows] = await queryInterface.sequelize.query(
            "SELECT id FROM industry WHERE industry_code = :code LIMIT 1",
            { replacements: { code: PERSONAL_CODE }, transaction },
          );
          if (reservedRows.length) throw new Error("IND-PERSONAL code belongs to another Industry; reconcile before migration");
          await queryInterface.sequelize.query(
            "UPDATE industry SET industry_code = :code WHERE id = :id",
            { replacements: { code: PERSONAL_CODE, id: personalIndustryId }, transaction },
          );
        }
        await queryInterface.sequelize.query(
          "UPDATE industry SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = :id",
          { replacements: { id: personalIndustryId }, transaction },
        );
      }

      // Existing PERSONAL Accounts can be mapped unambiguously from their existing type.
      await queryInterface.sequelize.query(
        "UPDATE account SET industry_id = :industryId WHERE account_type = 'PERSONAL' AND industry_id IS NULL",
        { replacements: { industryId: personalIndustryId }, transaction },
      );
      const [unmappedAccounts] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS count FROM account WHERE industry_id IS NULL",
        { transaction },
      );
      if (Number(unmappedAccounts[0]?.count ?? 0) > 0) {
        throw new Error("Some existing Corporate Accounts have no Industry. Map them to the correct Industry before rerunning the ST-11 migration; no Industry was guessed.");
      }
      const [inconsistentTypes] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS count FROM account a JOIN industry i ON i.id = a.industry_id
         WHERE (a.account_type = 'PERSONAL' AND i.industry_code <> :personalCode)
            OR (a.account_type = 'CORPORATE' AND i.industry_code = :personalCode)`,
        { replacements: { personalCode: PERSONAL_CODE }, transaction },
      );
      if (Number(inconsistentTypes[0]?.count ?? 0) > 0) {
        throw new Error("Existing Account type does not match its Industry. Reconcile those records before rerunning the ST-11 migration.");
      }
      // SQL Server will not alter nullability while the existing nonclustered
      // index depends on this column. Drop/recreate that index in this migration.
      await queryInterface.removeIndex("account", "ix_account_industry_id", { transaction });
      // PostgreSQL also prevents changing a column's nullability while a trigger
      // references it, so temporarily remove the history trigger and restore it below.
      await queryInterface.sequelize.query("DROP TRIGGER tr_account_industry_history ON account", { transaction });
      await queryInterface.sequelize.query("DROP FUNCTION record_account_industry_history()", { transaction });
      await queryInterface.changeColumn("account", "industry_id", { type: Sequelize.UUID, allowNull: false }, { transaction });
      await queryInterface.addIndex("account", ["industry_id"], { name: "ix_account_industry_id", transaction });
      await queryInterface.sequelize.query(
        `CREATE FUNCTION record_account_industry_history() RETURNS trigger AS $$
         BEGIN
           IF TG_OP = 'INSERT' OR NEW.industry_id IS DISTINCT FROM OLD.industry_id THEN
             IF NEW.industry_id IS NOT NULL THEN
               INSERT INTO account_industry_history (id, account_id, industry_id, assigned_at)
               VALUES (gen_random_uuid(), NEW.id, NEW.industry_id, CURRENT_TIMESTAMP);
             END IF;
           END IF;
           RETURN NEW;
         END; $$ LANGUAGE plpgsql;
         CREATE TRIGGER tr_account_industry_history AFTER INSERT OR UPDATE OF industry_id ON account
         FOR EACH ROW EXECUTE FUNCTION record_account_industry_history();`, { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE account ADD CONSTRAINT ck_account_personal_student_type CHECK (personal_student_subject IS NULL OR account_type = 'PERSONAL')",
        { transaction },
      );

      const [countRows] = await queryInterface.sequelize.query("SELECT COUNT(*) AS count FROM account", { transaction });
      const nextCode = Number(countRows[0]?.count ?? 0) + 1;
      await queryInterface.sequelize.query(
        `WITH numbered AS (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS n FROM account)
         UPDATE account AS a SET account_code = 'ACC-' || LPAD(numbered.n::text, 6, '0')
         FROM numbered WHERE numbered.id = a.id`,
        { transaction },
      );
      await queryInterface.changeColumn("account", "account_code", { type: Sequelize.STRING(20), allowNull: false }, { transaction });
      await queryInterface.addIndex("account", ["account_code"], { name: "uq_account_account_code", unique: true, transaction });
      await queryInterface.sequelize.query("CREATE UNIQUE INDEX uq_account_personal_student_subject ON account (personal_student_subject) WHERE personal_student_subject IS NOT NULL", { transaction });
      await queryInterface.addIndex("participant", ["student_subject"], { name: "ix_participant_student_subject", transaction });
      await queryInterface.sequelize.query(`CREATE SEQUENCE account_code_seq START WITH ${nextCode} INCREMENT BY 1`, { transaction });

      // Database-level guard protects Training writes regardless of which future route performs them.
      await queryInterface.sequelize.query(
        `CREATE FUNCTION enforce_training_active_account() RETURNS trigger AS $$
         BEGIN
           IF (TG_OP = 'INSERT' OR NEW.account_id IS DISTINCT FROM OLD.account_id)
              AND EXISTS (SELECT 1 FROM account WHERE id = NEW.account_id AND status <> 'ACTIVE') THEN
             RAISE EXCEPTION 'Training cannot be created or moved to an inactive Account.' USING ERRCODE = '23514';
           END IF;
           RETURN NEW;
         END; $$ LANGUAGE plpgsql;
         CREATE TRIGGER tr_training_requires_active_account BEFORE INSERT OR UPDATE OF account_id ON training
         FOR EACH ROW EXECUTE FUNCTION enforce_training_active_account();`, { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE FUNCTION enforce_personal_industry_active() RETURNS trigger AS $$
         BEGIN
           IF OLD.industry_code = '${PERSONAL_CODE}' AND NEW.status <> 'ACTIVE' THEN
             RAISE EXCEPTION 'The Personal Industry must remain active.' USING ERRCODE = '23514';
           END IF;
           RETURN NEW;
         END; $$ LANGUAGE plpgsql;
         CREATE TRIGGER tr_personal_industry_must_remain_active BEFORE UPDATE ON industry
         FOR EACH ROW EXECUTE FUNCTION enforce_personal_industry_active();`, { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE FUNCTION prevent_personal_industry_delete() RETURNS trigger AS $$
         BEGIN
           IF OLD.industry_code = '${PERSONAL_CODE}' THEN
             RAISE EXCEPTION 'The system Personal Industry cannot be deleted.' USING ERRCODE = '23514';
           END IF;
           RETURN OLD;
         END; $$ LANGUAGE plpgsql;
         CREATE TRIGGER tr_personal_industry_cannot_be_deleted BEFORE DELETE ON industry
         FOR EACH ROW EXECUTE FUNCTION prevent_personal_industry_delete();`, { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE FUNCTION enforce_account_code_immutable() RETURNS trigger AS $$
         BEGIN
           IF NEW.account_code IS DISTINCT FROM OLD.account_code THEN
             RAISE EXCEPTION 'Account Code is generated and cannot be changed.' USING ERRCODE = '23514';
           END IF;
           RETURN NEW;
         END; $$ LANGUAGE plpgsql;
         CREATE TRIGGER tr_account_code_immutable BEFORE UPDATE OF account_code ON account
         FOR EACH ROW EXECUTE FUNCTION enforce_account_code_immutable();`, { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE FUNCTION enforce_account_type_matches_industry() RETURNS trigger AS $$
         BEGIN
           IF EXISTS (SELECT 1 FROM industry WHERE id = NEW.industry_id AND
             ((NEW.account_type = 'PERSONAL' AND industry_code <> '${PERSONAL_CODE}') OR
              (NEW.account_type = 'CORPORATE' AND industry_code = '${PERSONAL_CODE}'))) THEN
             RAISE EXCEPTION 'Account type must match the selected Industry.' USING ERRCODE = '23514';
           END IF;
           RETURN NEW;
         END; $$ LANGUAGE plpgsql;
         CREATE TRIGGER tr_account_type_matches_industry BEFORE INSERT OR UPDATE OF account_type, industry_id ON account
         FOR EACH ROW EXECUTE FUNCTION enforce_account_type_matches_industry();`, { transaction },
      );

      // ST-11 business authorization: Sales CRUD; Admin can view and link Student identity only.
      const grants = [
        { role: "sales", can_view: true, can_create: true, can_edit: true, can_delete: true },
        { role: "admin", can_view: true, can_create: false, can_edit: true, can_delete: false },
      ];
      for (const grant of grants) {
        const [existing] = await queryInterface.sequelize.query(
          "SELECT id, can_view, can_create, can_edit, can_delete FROM role_access_matrix WHERE role = :role AND resource_group = 'ACCOUNT' LIMIT 1",
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
            "UPDATE role_access_matrix SET can_view = :can_view, can_create = :can_create, can_edit = :can_edit, can_delete = :can_delete, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
            { replacements: { ...after, id: existing[0].id }, transaction },
          );
        } else {
          await queryInterface.sequelize.query(
            "INSERT INTO role_access_matrix (id, role, resource_group, can_view, can_create, can_edit, can_delete, created_at, updated_at) VALUES (gen_random_uuid(), :role, 'ACCOUNT', :can_view, :can_create, :can_edit, :can_delete, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            { replacements: { role: grant.role, ...after }, transaction },
          );
        }
        await queryInterface.sequelize.query(
          "INSERT INTO audit_trail (id, actor_subject, actor_name, actor_type, active_role, process_name, action, object_type, object_id, source_service, data_before, data_after, created_at) VALUES (gen_random_uuid(), 'SYSTEM:ST11_MIGRATION', 'ST-11 migration', 'SYSTEM', NULL, 'st11-account-capability-grant', 'UPDATE', 'ROLE_ACCESS_MATRIX', :objectId, 'internal-api', :before, :after, CURRENT_TIMESTAMP)",
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
