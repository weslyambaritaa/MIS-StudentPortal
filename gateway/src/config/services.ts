import { env } from "./env";

export const services = {
  external: env.studentApiUrl,
  internal: env.internalApiUrl,
  keycloak: env.keycloakInternalUrl,
} as const;
