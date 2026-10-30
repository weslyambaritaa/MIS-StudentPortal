"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable("trainer_booking", {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        trainer_profile_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "trainer_profile", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        booking_date: { type: Sequelize.DATEONLY, allowNull: false },
        reason: { type: Sequelize.TEXT, allowNull: false },
        detail_booking: { type: Sequelize.TEXT, allowNull: false },
        status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "BOOKED" },
        created_by_subject: { type: Sequelize.STRING(255), allowNull: false },
        replaced_by_training_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: "training", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      }, { transaction });
      await queryInterface.sequelize.query(`
        ALTER TABLE trainer_booking
        ADD CONSTRAINT ck_trainer_booking_replacement_state
        CHECK (
          (status = 'BOOKED' AND replaced_by_training_id IS NULL)
          OR (status = 'REPLACED_BY_TRAINING' AND replaced_by_training_id IS NOT NULL)
        )
      `, { transaction });
      await queryInterface.addIndex("trainer_booking", ["trainer_profile_id", "booking_date"], {
        name: "uq_trainer_booking_active_date",
        unique: true,
        where: { status: "BOOKED" },
        transaction,
      });
      await queryInterface.addIndex("trainer_booking", ["replaced_by_training_id"], {
        name: "ix_trainer_booking_replaced_by_training",
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
      await queryInterface.dropTable("trainer_booking", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
