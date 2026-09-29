import { Account } from "../../database/models/account.model";
import { PicAccountAssignment } from "../../database/models/pic-account-assignment.model";
import { Training } from "../../database/models/training.model";

/** Returns only trainings owned by the PIC's one active Account assignment. */
export function findTrainingsInPicScope(picProfileId: string) {
  if (!picProfileId.trim()) {
    throw new Error("A PIC profile ID is required to resolve training scope");
  }

  return Training.findAll({
    attributes: ["id", "account_id", "name"],
    include: [
      {
        model: Account,
        as: "account",
        attributes: [],
        required: true,
        include: [
          {
            model: PicAccountAssignment,
            as: "picAssignments",
            attributes: [],
            required: true,
            where: { pic_profile_id: picProfileId, ended_at: null },
          },
        ],
      },
    ],
    order: [["name", "ASC"]],
  });
}
