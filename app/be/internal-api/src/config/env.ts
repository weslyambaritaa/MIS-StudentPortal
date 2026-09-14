import "dotenv/config";
function required(name: string): string { const value = process.env[name]; if (!value) throw new Error(`Missing required environment variable: ${name}`); return value; }
export const env = {
  port: Number(process.env.PORT ?? 4002), nodeEnv: process.env.NODE_ENV ?? "development",
  dbHost: required("DB_HOST"), dbPort: Number(process.env.DB_PORT ?? 1433), dbName: required("DB_NAME"), dbUser: required("DB_USER"), dbPassword: required("DB_PASSWORD"),
  dbEncrypt: process.env.DB_ENCRYPT === "true", dbTrustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
  gatewaySharedSecret: required("GATEWAY_SHARED_SECRET"),
};
