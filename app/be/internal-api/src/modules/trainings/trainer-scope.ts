import { Op } from "sequelize";

import { SessionTrainerAssignment } from "../../database/models/session-trainer-assignment.model";
import { SessionTrainerReplacement } from "../../database/models/session-trainer-replacement.model";
import { TrainingSession } from "../../database/models/training-session.model";
import { TrainingTrainerAssignment } from "../../database/models/training-trainer-assignment.model";
import { Training } from "../../database/models/training.model";

export type TrainerTrainingScopeRow = { id: string; account_id: string; name: string };
export type TrainerSessionScopeRow = { id: string; training_id: string; session_number: number; starts_at: Date; ends_at: Date };

function requireTrainerProfileId(trainerProfileId: string) {
  if (!trainerProfileId.trim()) throw new Error("A Trainer profile ID is required to resolve scope");
}

async function loadEffectiveAssignments(trainerProfileId: string) {
  const [trainingAssignments, sessionAssignments] = await Promise.all([
    TrainingTrainerAssignment.findAll({ where: { trainer_profile_id: trainerProfileId, ended_at: null } }),
    SessionTrainerAssignment.findAll({ where: { trainer_profile_id: trainerProfileId, ended_at: null } }),
  ]);
  const assignedTrainingIds = [...new Set(trainingAssignments.map((assignment) => assignment.training_id))];
  const ownSessionIds = [...new Set(sessionAssignments.map((assignment) => assignment.session_id))];
  const sessions = await TrainingSession.findAll({ where: { [Op.or]: [
    ...(assignedTrainingIds.length ? [{ training_id: { [Op.in]: assignedTrainingIds } }] : []),
    ...(ownSessionIds.length ? [{ id: { [Op.in]: ownSessionIds } }] : []),
  ] } });
  const sessionIds = sessions.map((session) => session.id);
  const replacements = sessionIds.length ? await SessionTrainerReplacement.findAll({ where: { session_id: { [Op.in]: sessionIds }, ended_at: null } }) : [];
  const substituteIds = [...new Set(replacements.map((replacement) => replacement.substitute_assignment_id))];
  const activeSubstitutes = substituteIds.length ? await SessionTrainerAssignment.findAll({ where: { id: { [Op.in]: substituteIds }, ended_at: null }, attributes: ["id"] }) : [];
  const activeAssignmentIds = new Set(activeSubstitutes.map((assignment) => assignment.id));
  const activeReplacements = replacements.filter((replacement) => activeAssignmentIds.has(replacement.substitute_assignment_id));
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const replacedSessionIds = new Set(activeReplacements.map((replacement) => replacement.replaced_session_assignment_id).filter((id): id is string => Boolean(id)));
  const replacedTrainingBySession = new Map<string, Set<string>>();
  for (const replacement of activeReplacements) {
    if (replacement.replaced_training_assignment_id) {
      const set = replacedTrainingBySession.get(replacement.session_id) ?? new Set<string>();
      set.add(replacement.replaced_training_assignment_id);
      replacedTrainingBySession.set(replacement.session_id, set);
    }
  }
  const ownReplacementAssignmentIds = new Set(activeReplacements.map((replacement) => replacement.substitute_assignment_id));
  const eligibleOwnSessionAssignments = sessionAssignments.filter((assignment) =>
    (assignment.assignment_type === "ASSISTANT" || ownReplacementAssignmentIds.has(assignment.id)) && !replacedSessionIds.has(assignment.id),
  );
  return { trainingAssignments, eligibleOwnSessionAssignments, sessions, sessionMap, replacedTrainingBySession };
}

/** Training-level assignments grant Training scope; session assignments grant only their Session. */
export async function findTrainingsInTrainerScope(trainerProfileId: string) {
  requireTrainerProfileId(trainerProfileId);
  const scope = await loadEffectiveAssignments(trainerProfileId);
  const trainingIds = new Set(scope.trainingAssignments.map((assignment) => assignment.training_id));
  for (const assignment of scope.eligibleOwnSessionAssignments) {
    const session = scope.sessionMap.get(assignment.session_id);
    if (session) trainingIds.add(session.training_id);
  }
  return Training.findAll({ where: { id: { [Op.in]: [...trainingIds] } }, attributes: ["id", "account_id", "name"], order: [["name", "ASC"]], raw: true });
}

/** Computes effective Session scope, including active substitutes and excluding replaced trainers for that Session. */
export async function findSessionsInTrainerScope(trainerProfileId: string) {
  requireTrainerProfileId(trainerProfileId);
  const scope = await loadEffectiveAssignments(trainerProfileId);
  const trainingAssignmentIds = new Set(scope.trainingAssignments.map((assignment) => assignment.id));
  const assignedTrainingIds = new Set(scope.trainingAssignments.map((assignment) => assignment.training_id));
  const scoped = scope.sessions.filter((session) => {
    const trainingIsAssigned = assignedTrainingIds.has(session.training_id) &&
      !(scope.replacedTrainingBySession.get(session.id)?.size && [...(scope.replacedTrainingBySession.get(session.id) ?? [])].some((id) => trainingAssignmentIds.has(id)));
    const sessionIsAssigned = scope.eligibleOwnSessionAssignments.some((assignment) => assignment.session_id === session.id);
    return trainingIsAssigned || sessionIsAssigned;
  });
  return scoped.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime()).map(({ id, training_id, session_number, starts_at, ends_at }) => ({ id, training_id, session_number, starts_at, ends_at }));
}
