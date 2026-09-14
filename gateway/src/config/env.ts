import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  studentApiUrl: required("STUDENT_API_URL"),
  internalApiUrl: required("INTERNAL_API_URL"),
  keycloakInternalUrl: required("KEYCLOAK_INTERNAL_URL"),
  keycloakPublicHost: required("KEYCLOAK_PUBLIC_HOST"),
  keycloakIssuer: required("KEYCLOAK_ISSUER"),
  keycloakJwksInternalUrl: required("KEYCLOAK_JWKS_INTERNAL_URL"),
  keycloakAudience: required("KEYCLOAK_AUDIENCE"),
  gatewaySharedSecret: required("GATEWAY_SHARED_SECRET"),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  cacheEnabled: process.env.CACHE_ENABLED === "true",
  redisUrl: process.env.REDIS_URL ?? "redis://redis:6379",
};
