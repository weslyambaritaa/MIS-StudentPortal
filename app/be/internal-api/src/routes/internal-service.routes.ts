import { Router } from "express";

import { serviceAuth } from "../middlewares/service-auth.middleware";
import { auditTrailIngestionRouter } from "../modules/audit-trail/audit-trail.route";
import { studentLoginSyncRouter } from "../modules/students/student-login-sync.route";

/** Reserved service-only namespace. Business handlers are added in their domain checkpoints. */
export const internalServiceRoutes = Router();
internalServiceRoutes.use(serviceAuth);
internalServiceRoutes.use("/audit-trail/events", auditTrailIngestionRouter);
internalServiceRoutes.use("/students", studentLoginSyncRouter);
