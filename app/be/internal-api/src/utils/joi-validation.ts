import Joi, { type Schema } from "joi";
import { AppError } from "../errors/app-error";

/** Validates untrusted HTTP input at runtime and returns its typed value. */
export function validateBody<T>(schema: Schema, input: unknown): T {
  const { error, value } = schema.validate(input, {
    abortEarly: false,
    allowUnknown: false,
    convert: false,
    errors: { wrap: { label: "" } },
  });
  if (error) {
    const details = error.details.map((detail) => detail.message).join("; ");
    throw new AppError(400, details || "Invalid request body");
  }
  return value as T;
}
