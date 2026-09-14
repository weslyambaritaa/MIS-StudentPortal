import "dotenv/config";
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
export const env = {
  port: Number(process.env.PORT ?? 4001),
  nodeEnv: process.env.NODE_ENV ?? "development",
  dbHost: required("DB_HOST"),
  dbPort: Number(process.env.DB_PORT ?? 5432),
  dbName: required("DB_NAME"),
  dbUser: required("DB_USER"),
  dbPassword: required("DB_PASSWORD"),
  gatewaySharedSecret: required("GATEWAY_SHARED_SECRET"),
};
