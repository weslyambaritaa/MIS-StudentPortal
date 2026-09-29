"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("remote_lab", ["training_id"], { name: "uq_remote_lab_training_id", unique: true });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex("remote_lab", "uq_remote_lab_training_id");
  },
};
