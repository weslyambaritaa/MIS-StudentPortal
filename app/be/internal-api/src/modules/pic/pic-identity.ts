import { PicProfile } from "../../database/models/pic-profile.model";
import { requireIdentitySubject } from "../identity/identity-subject";

export type PicIdentityResolution =
  | { status: "resolved"; profile: PicProfile; profileId: string }
  | { status: "missing" };

/** Resolve only from the authenticated Keycloak subject (normally req.auth.userId). */
export async function resolvePicIdentity(subject: unknown): Promise<PicIdentityResolution> {
  const keycloakSubject = requireIdentitySubject(subject);
  const profile = await PicProfile.findOne({
    attributes: ["id", "keycloak_subject"],
    where: { keycloak_subject: keycloakSubject },
  });

  if (!profile) return { status: "missing" };
  return { status: "resolved", profile, profileId: profile.id };
}
