import { TrainerProfile } from "../../database/models/trainer-profile.model";
import { requireIdentitySubject } from "../identity/identity-subject";

export type TrainerIdentityResolution =
  | { status: "resolved"; profile: TrainerProfile; profileId: string }
  | { status: "missing" };

/** Resolve only from the authenticated Keycloak subject (normally req.auth.userId). */
export async function resolveTrainerIdentity(subject: unknown): Promise<TrainerIdentityResolution> {
  const keycloakSubject = requireIdentitySubject(subject);
  const profile = await TrainerProfile.findOne({
    attributes: ["id", "keycloak_subject"],
    where: { keycloak_subject: keycloakSubject },
  });

  if (!profile) return { status: "missing" };
  return { status: "resolved", profile, profileId: profile.id };
}
