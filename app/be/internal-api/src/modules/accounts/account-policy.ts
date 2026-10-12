export const PERSONAL_INDUSTRY_CODE = "IND-PERSONAL";

export type ManagedAccountType = "PERSONAL" | "CORPORATE";
export function accountTypeForIndustry(industryCode: string): ManagedAccountType {
  return industryCode === PERSONAL_INDUSTRY_CODE ? "PERSONAL" : "CORPORATE";
}

export function assertAccountDeletable(trainingCount: number) {
  if (!Number.isSafeInteger(trainingCount) || trainingCount < 0) throw new TypeError("Training count must be a non-negative integer");
  if (trainingCount > 0) {
    const error = new Error("Account cannot be deleted because it has Training history");
    Object.assign(error, { statusCode: 409 });
    throw error;
  }
}

export function assertAccountTypeChangeAllowed(input: { linkedPersonalStudent: boolean; trainingCount: number; participantCount: number }) {
  if (input.linkedPersonalStudent || input.trainingCount > 0 || input.participantCount > 0) {
    const error = new Error("Account type cannot be changed after Student or Training history is linked");
    Object.assign(error, { statusCode: 409 });
    throw error;
  }
}
