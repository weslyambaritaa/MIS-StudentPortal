"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        "training_trainer_assignment",
        {
          id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
          training_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "training", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          trainer_profile_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "trainer_profile", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          assignment_type: { type: Sequelize.STRING(20), allowNull: false },
          assigned_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETUTCDATE()"),
          },
          ended_at: { type: Sequelize.DATE, allowNull: true },
          assigned_by_subject: { type: Sequelize.STRING(255), allowNull: true },
          ended_by_subject: { type: Sequelize.STRING(255), allowNull: true },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETUTCDATE()"),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETUTCDATE()"),
          },
        },
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE training_trainer_assignment ADD CONSTRAINT ck_training_trainer_assignment_type CHECK (assignment_type IN ('PRIMARY', 'ASSISTANT'))",
        { transaction },
      );
      await queryInterface.addIndex("training_trainer_assignment", ["training_id", "ended_at"], {
        name: "ix_training_trainer_assignment_training_active",
        transaction,
      });
      await queryInterface.addIndex("training_trainer_assignment", ["trainer_profile_id", "ended_at"], {
        name: "ix_training_trainer_assignment_trainer_active",
        transaction,
      });

      await queryInterface.createTable(
        "session_trainer_assignment",
        {
          id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
          session_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "training_session", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          trainer_profile_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "trainer_profile", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          assignment_type: { type: Sequelize.STRING(20), allowNull: false },
          assigned_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETUTCDATE()"),
          },
          ended_at: { type: Sequelize.DATE, allowNull: true },
          assigned_by_subject: { type: Sequelize.STRING(255), allowNull: true },
          ended_by_subject: { type: Sequelize.STRING(255), allowNull: true },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETUTCDATE()"),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETUTCDATE()"),
          },
        },
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE session_trainer_assignment ADD CONSTRAINT ck_session_trainer_assignment_type CHECK (assignment_type IN ('ASSISTANT', 'SUBSTITUTE'))",
        { transaction },
      );
      await queryInterface.addIndex("session_trainer_assignment", ["session_id", "ended_at"], {
        name: "ix_session_trainer_assignment_session_active",
        transaction,
      });
      await queryInterface.addIndex("session_trainer_assignment", ["trainer_profile_id", "ended_at"], {
        name: "ix_session_trainer_assignment_trainer_active",
        transaction,
      });

      await queryInterface.createTable(
        "session_trainer_replacement",
        {
          id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
          session_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "training_session", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          substitute_assignment_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "session_trainer_assignment", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          replaced_training_assignment_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "training_trainer_assignment", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          replaced_session_assignment_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "session_trainer_assignment", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          assigned_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETUTCDATE()"),
          },
          ended_at: { type: Sequelize.DATE, allowNull: true },
          assigned_by_subject: { type: Sequelize.STRING(255), allowNull: true },
          ended_by_subject: { type: Sequelize.STRING(255), allowNull: true },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETUTCDATE()"),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETUTCDATE()"),
          },
        },
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE session_trainer_replacement ADD CONSTRAINT ck_session_trainer_replacement_one_source CHECK ((replaced_training_assignment_id IS NOT NULL AND replaced_session_assignment_id IS NULL) OR (replaced_training_assignment_id IS NULL AND replaced_session_assignment_id IS NOT NULL))",
        { transaction },
      );
      await queryInterface.addIndex("session_trainer_replacement", ["substitute_assignment_id"], {
        name: "uq_session_trainer_replacement_active_substitute",
        unique: true,
        where: { ended_at: null },
        transaction,
      });
      await queryInterface.addIndex("session_trainer_replacement", ["session_id", "replaced_training_assignment_id"], {
        name: "uq_session_trainer_replacement_active_training_source",
        unique: true,
        where: { ended_at: null, replaced_training_assignment_id: { [Sequelize.Op.ne]: null } },
        transaction,
      });
      await queryInterface.addIndex("session_trainer_replacement", ["session_id", "replaced_session_assignment_id"], {
        name: "uq_session_trainer_replacement_active_session_source",
        unique: true,
        where: { ended_at: null, replaced_session_assignment_id: { [Sequelize.Op.ne]: null } },
        transaction,
      });
      await queryInterface.addIndex("session_trainer_replacement", ["session_id", "ended_at"], {
        name: "ix_session_trainer_replacement_session_active",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.dropTable("session_trainer_replacement", { transaction });
      await queryInterface.dropTable("session_trainer_assignment", { transaction });
      await queryInterface.dropTable("training_trainer_assignment", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
