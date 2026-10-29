import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const keycloakAudiences = (process.env.KEYCLOAK_AUDIENCES ?? process.env.KEYCLOAK_AUDIENCE ?? "")
  .split(",").map((audience) => audience.trim()).filter(Boolean);
if (keycloakAudiences.length === 0) throw new Error("Missing required environment variable: KEYCLOAK_AUDIENCES");

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map((origin) => origin.trim()).filter(Boolean),
  studentApiUrl: required("STUDENT_API_URL"),
  internalApiUrl: required("INTERNAL_API_URL"),
  keycloakInternalUrl: required("KEYCLOAK_INTERNAL_URL"),
  keycloakPublicHost: required("KEYCLOAK_PUBLIC_HOST"),
  keycloakIssuer: required("KEYCLOAK_ISSUER"),
  keycloakJwksInternalUrl: required("KEYCLOAK_JWKS_INTERNAL_URL"),
  keycloakAudiences,
  gatewaySharedSecret: required("GATEWAY_SHARED_SECRET"),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  cacheEnabled: process.env.CACHE_ENABLED === "true",
  redisUrl: process.env.REDIS_URL ?? "redis://redis:6379",
};
