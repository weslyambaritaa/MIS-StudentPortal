import "dotenv/config";
function required(name: string): string { const value = process.env[name]; if (!value) throw new Error(`Missing required environment variable: ${name}`); return value; }
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY?.trim();
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
const cloudinaryCredentialParts = [cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret];
if (cloudinaryCredentialParts.some(Boolean) && !cloudinaryCredentialParts.every(Boolean)) {
  throw new Error("Cloudinary credentials must be configured together (cloud name, API key, and API secret)");
}
export const env = {
  port: Number(process.env.PORT ?? 4002), nodeEnv: process.env.NODE_ENV ?? "development",
  dbHost: required("DB_HOST"), dbPort: Number(process.env.DB_PORT ?? 5432), dbName: required("DB_NAME"), dbUser: required("DB_USER"), dbPassword: required("DB_PASSWORD"),
  gatewaySharedSecret: required("GATEWAY_SHARED_SECRET"),
  serviceSharedSecret: required("SERVICE_SHARED_SECRET"),
  studentApiUrl: required("STUDENT_API_URL"),
  keycloakUrl: process.env.KEYCLOAK_INTERNAL_URL ?? "http://keycloak:8080",
  keycloakRealm: process.env.KEYCLOAK_REALM ?? "mis-student-portal",
  keycloakProvisionerClientId: process.env.KEYCLOAK_PROVISIONER_CLIENT_ID ?? "mis-account-provisioner",
  keycloakProvisionerClientSecret: process.env.KEYCLOAK_PROVISIONER_CLIENT_SECRET,
  keycloakPicActivationClientId: process.env.KEYCLOAK_PIC_ACTIVATION_CLIENT_ID ?? "mis-student-portal-frontend",
  keycloakPicActivationRedirectUri: process.env.KEYCLOAK_PIC_ACTIVATION_REDIRECT_URI ?? "http://localhost:3000/dashboard",
  keycloakTrainerActivationClientId: process.env.KEYCLOAK_TRAINER_ACTIVATION_CLIENT_ID ?? "mis-student-portal-frontend",
  keycloakTrainerActivationRedirectUri: process.env.KEYCLOAK_TRAINER_ACTIVATION_REDIRECT_URI ?? "http://localhost:3100/dashboard",
  keycloakAuditEnabled: process.env.KEYCLOAK_AUDIT_ENABLED === "true",
  keycloakAuditClientId: process.env.KEYCLOAK_AUDIT_CLIENT_ID ?? "mis-audit-reader",
  keycloakAuditClientSecret: process.env.KEYCLOAK_AUDIT_CLIENT_SECRET,
  keycloakAuditPollIntervalMs: Number(process.env.KEYCLOAK_AUDIT_POLL_INTERVAL_MS ?? 60_000),
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
  cloudinaryConfigured: cloudinaryCredentialParts.every(Boolean),
  mailHost: process.env.MAIL_HOST,
  mailPort: Number(process.env.MAIL_PORT ?? 587),
  mailUsername: process.env.MAIL_USERNAME,
  mailPassword: process.env.MAIL_PASSWORD,
  mailEncryption: process.env.MAIL_ENCRYPTION ?? "tls",
  mailFromAddress: process.env.MAIL_FROM_ADDRESS,
  mailFromName: process.env.MAIL_FROM_NAME ?? "ExecuTrain",
  developerSupportEmail: process.env.DEVELOPER_SUPPORT_EMAIL,
};
