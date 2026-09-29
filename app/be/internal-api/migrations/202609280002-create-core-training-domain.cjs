"use strict";

const timestamps = (Sequelize) => ({
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
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        "account",
        {
          id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
          name: { type: Sequelize.STRING(200), allowNull: false },
          ...timestamps(Sequelize),
        },
        { transaction },
      );

      await queryInterface.createTable(
        "training",
        {
          id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
          account_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "account", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          name: { type: Sequelize.STRING(200), allowNull: false },
          ...timestamps(Sequelize),
        },
        { transaction },
      );
      await queryInterface.addIndex("training", ["account_id"], {
        name: "ix_training_account_id",
        transaction,
      });

      await queryInterface.createTable(
        "training_session",
        {
          id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
          training_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "training", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          session_number: { type: Sequelize.INTEGER, allowNull: false },
          starts_at: { type: Sequelize.DATE, allowNull: false },
          ends_at: { type: Sequelize.DATE, allowNull: false },
          ...timestamps(Sequelize),
        },
        { transaction },
      );
      await queryInterface.addIndex("training_session", ["training_id", "session_number"], {
        name: "uq_training_session_number",
        unique: true,
        transaction,
      });

      await queryInterface.createTable(
        "participant",
        {
          id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
          training_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "training", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
          },
          // Opaque Student PostgreSQL ID. Intentionally no cross-database FK.
          student_id: { type: Sequelize.UUID, allowNull: true },
          full_name: { type: Sequelize.STRING(200), allowNull: false },
          ...timestamps(Sequelize),
        },
        { transaction },
      );
      await queryInterface.addIndex("participant", ["training_id"], {
        name: "ix_participant_training_id",
        transaction,
      });
      await queryInterface.addIndex("participant", ["student_id"], {
        name: "ix_participant_student_id",
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
      await queryInterface.dropTable("participant", { transaction });
      await queryInterface.dropTable("training_session", { transaction });
      await queryInterface.dropTable("training", { transaction });
      await queryInterface.dropTable("account", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
