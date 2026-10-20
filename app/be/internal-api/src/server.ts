import { app } from "./app";
import { env } from "./config/env";
import { startSecurityAccessLogArchiveWorker } from "./modules/access-logs/security-access-log-archive.worker";
import { startKeycloakEventCollector } from "./modules/access-logs/keycloak-event-collector.worker";
import { startAuditTrailArchiveWorker } from "./modules/audit-trail/audit-trail-archive.worker";
import { startRequestFormSlaWorker } from "./modules/request-forms/request-form-sla.worker";

app.listen(env.port, "0.0.0.0", () => {
  console.log(`internal-api running on :${env.port}`);
  startSecurityAccessLogArchiveWorker();
  startKeycloakEventCollector();
  startAuditTrailArchiveWorker();
  startRequestFormSlaWorker();
});
