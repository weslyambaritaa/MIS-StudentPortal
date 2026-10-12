import { app } from "./app";
import { env } from "./config/env";
import { startAuditOutboxWorker } from "./modules/audit-trail/audit-outbox.worker";
app.listen(env.port, "0.0.0.0", () => {
  console.log(`student-api running on :${env.port}`);
  startAuditOutboxWorker();
});
