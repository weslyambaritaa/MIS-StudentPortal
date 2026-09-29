import { QueryTypes } from "sequelize";

import { sequelize } from "../../database/sequelize";

export type TrainerTrainingScopeRow = {
  id: string;
  account_id: string;
  name: string;
};

export type TrainerSessionScopeRow = {
  id: string;
  training_id: string;
  session_number: number;
  starts_at: Date;
  ends_at: Date;
};

function requireTrainerProfileId(trainerProfileId: string) {
  if (!trainerProfileId.trim()) {
    throw new Error("A Trainer profile ID is required to resolve scope");
  }
}

/** Training-level assignments grant Training scope; session assignments grant only their Session. */
export function findTrainingsInTrainerScope(trainerProfileId: string) {
  requireTrainerProfileId(trainerProfileId);

  return sequelize.query<TrainerTrainingScopeRow>(
    `SELECT DISTINCT t.id, t.account_id, t.name
     FROM training AS t
     WHERE EXISTS (
       SELECT 1
       FROM training_trainer_assignment AS tta
       WHERE tta.training_id = t.id
         AND tta.trainer_profile_id = :trainerProfileId
         AND tta.ended_at IS NULL
     ) OR EXISTS (
       SELECT 1
       FROM training_session AS s
       INNER JOIN session_trainer_assignment AS sta ON sta.session_id = s.id
       WHERE s.training_id = t.id
         AND sta.trainer_profile_id = :trainerProfileId
         AND sta.ended_at IS NULL
         AND (
           sta.assignment_type = 'ASSISTANT'
           OR EXISTS (
             SELECT 1
             FROM session_trainer_replacement AS own_replacement
             WHERE own_replacement.session_id = s.id
               AND own_replacement.substitute_assignment_id = sta.id
               AND own_replacement.ended_at IS NULL
           )
         )
         AND NOT EXISTS (
           SELECT 1
           FROM session_trainer_replacement AS replacement
           INNER JOIN session_trainer_assignment AS substitute
             ON substitute.id = replacement.substitute_assignment_id
            AND substitute.ended_at IS NULL
           WHERE replacement.session_id = s.id
             AND replacement.replaced_session_assignment_id = sta.id
             AND replacement.ended_at IS NULL
         )
     )
     ORDER BY t.name ASC`,
    { replacements: { trainerProfileId }, type: QueryTypes.SELECT },
  );
}

/**
 * Computes effective Session scope in SQL. Active substitutes are included;
 * the assignment they replace is excluded only for the affected Session.
 */
export function findSessionsInTrainerScope(trainerProfileId: string) {
  requireTrainerProfileId(trainerProfileId);

  return sequelize.query<TrainerSessionScopeRow>(
    `SELECT DISTINCT s.id, s.training_id, s.session_number, s.starts_at, s.ends_at
     FROM training_session AS s
     WHERE EXISTS (
       SELECT 1
       FROM training_trainer_assignment AS tta
       WHERE tta.training_id = s.training_id
         AND tta.trainer_profile_id = :trainerProfileId
         AND tta.ended_at IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM session_trainer_replacement AS replacement
           INNER JOIN session_trainer_assignment AS substitute
             ON substitute.id = replacement.substitute_assignment_id
            AND substitute.ended_at IS NULL
           WHERE replacement.session_id = s.id
             AND replacement.replaced_training_assignment_id = tta.id
             AND replacement.ended_at IS NULL
         )
     ) OR EXISTS (
       SELECT 1
       FROM session_trainer_assignment AS sta
       WHERE sta.session_id = s.id
         AND sta.trainer_profile_id = :trainerProfileId
         AND sta.ended_at IS NULL
         AND (
           sta.assignment_type = 'ASSISTANT'
           OR EXISTS (
             SELECT 1
             FROM session_trainer_replacement AS own_replacement
             WHERE own_replacement.session_id = s.id
               AND own_replacement.substitute_assignment_id = sta.id
               AND own_replacement.ended_at IS NULL
           )
         )
         AND NOT EXISTS (
           SELECT 1
           FROM session_trainer_replacement AS replacement
           INNER JOIN session_trainer_assignment AS substitute
             ON substitute.id = replacement.substitute_assignment_id
            AND substitute.ended_at IS NULL
           WHERE replacement.session_id = s.id
             AND replacement.replaced_session_assignment_id = sta.id
             AND replacement.ended_at IS NULL
         )
     )
     ORDER BY s.starts_at ASC`,
    { replacements: { trainerProfileId }, type: QueryTypes.SELECT },
  );
}
