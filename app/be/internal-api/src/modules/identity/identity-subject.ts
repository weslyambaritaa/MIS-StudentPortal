export class InvalidIdentitySubjectError extends Error {
  constructor() {
    super("A valid authenticated Keycloak subject is required");
    this.name = "InvalidIdentitySubjectError";
  }
}

export function requireIdentitySubject(subject: unknown): string {
  if (typeof subject !== "string" || subject.trim().length === 0) {
    throw new InvalidIdentitySubjectError();
  }

  return subject;
}
