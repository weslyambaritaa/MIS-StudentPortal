import { ROLES, type ActiveRoleAuthContext } from "@mis/shared-types";
import { UniqueConstraintError } from "sequelize";

import { StudentProfile } from "../../database/models/student-profile.model";
import { sequelize } from "../../database/sequelize";
import { enqueueAuditEvent } from "../audit-trail/audit-outbox.service";
import { requestInternalApi } from "../../integrations/internal-api/internal-api.client";

const loginSyncSubjects = new Set<string>();

async function syncStudentPortalLogin(auth: ActiveRoleAuthContext, studentId: string) {
  if (loginSyncSubjects.has(auth.userId)) return;
  loginSyncSubjects.add(auth.userId);
  try {
    await requestInternalApi<void>("/api/v1/internal-service/students/login", auth, { method: "POST", body: { studentId } });
  } catch {
    loginSyncSubjects.delete(auth.userId);
    // Login tracking is best-effort; an Internal API outage must not block Student access.
    console.warn("Could not sync Student first-login status");
  }
}

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
export async function ensureStudentIdentity(auth: ActiveRoleAuthContext, ipAddress: string | null = null) {
  if (auth.activeRole !== ROLES.STUDENT || !auth.roles.includes(ROLES.STUDENT)) {
    throw new InvalidStudentIdentityContextError("Student identity requires a validated active Student role");
  }

  const existing = await findStudentIdentity(auth.userId);
  if (existing) {
    await syncStudentPortalLogin(auth, existing.student_id);
    return existing;
  }

  try {
    const profile = await sequelize.transaction(async (transaction) => {
      const profile = await StudentProfile.create({ keycloak_subject: auth.userId }, { transaction });
      await enqueueAuditEvent(auth, {
        action: "CREATE",
        objectType: "STUDENT_PROFILE",
        objectId: profile.student_id,
        dataBefore: null,
        dataAfter: { student_id: profile.student_id },
        ipAddress,
        processName: "student-identity-lazy-creation",
      }, transaction);
      return profile;
    });
    await syncStudentPortalLogin(auth, profile.student_id);
    return profile;
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;

    const createdByConcurrentRequest = await findStudentIdentity(auth.userId);
    if (createdByConcurrentRequest) {
      await syncStudentPortalLogin(auth, createdByConcurrentRequest.student_id);
      return createdByConcurrentRequest;
    }
    throw error;
  }
}
