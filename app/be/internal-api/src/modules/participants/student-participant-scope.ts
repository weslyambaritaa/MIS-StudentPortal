import { Participant } from "../../database/models/participant.model";
import { Training } from "../../database/models/training.model";

/** Returns only this Student identity's Participant records, filtered by SQL. */
export function findParticipantsInStudentScope(studentId: string) {
  if (!studentId.trim()) {
    throw new Error("A Student ID is required to resolve Participant scope");
  }

  return Participant.findAll({
    attributes: ["id", "training_id", "student_id", "full_name"],
    where: { student_id: studentId },
    include: [
      {
        model: Training,
        as: "training",
        attributes: ["id", "name"],
        required: true,
      },
    ],
    order: [[{ model: Training, as: "training" }, "name", "ASC"]],
  });
}
