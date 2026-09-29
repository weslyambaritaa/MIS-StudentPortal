import { ROLES, type ActiveRoleAuthContext } from "@mis/shared-types";
import { UniqueConstraintError } from "sequelize";

import { StudentProfile } from "../../database/models/student-profile.model";

export class InvalidStudentIdentityContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStudentIdentityContextError";
  }
}

/** Read an existing Student Portal identity by its trusted Keycloak subject. */
export function findStudentIdentity(keycloakSubject: unknown) {
  if (typeof keycloakSubject !== "string" || keycloakSubject.trim().length === 0) {
    throw new InvalidStudentIdentityContextError("A valid authenticated Keycloak subject is required");
  }
  return StudentProfile.findOne({
    attributes: ["student_id", "keycloak_subject"],
    where: { keycloak_subject: keycloakSubject },
  });
}

/**
 * Lazily provision identity only while the validated active role is Student.
 * The unique subject index resolves concurrent first-access requests.
 */
export async function ensureStudentIdentity(auth: ActiveRoleAuthContext) {
  if (auth.activeRole !== ROLES.STUDENT || !auth.roles.includes(ROLES.STUDENT)) {
    throw new InvalidStudentIdentityContextError("Student identity requires a validated active Student role");
  }

  const existing = await findStudentIdentity(auth.userId);
  if (existing) return existing;

  try {
    return await StudentProfile.create({ keycloak_subject: auth.userId });
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;

    const createdByConcurrentRequest = await findStudentIdentity(auth.userId);
    if (createdByConcurrentRequest) return createdByConcurrentRequest;
    throw error;
  }
}
