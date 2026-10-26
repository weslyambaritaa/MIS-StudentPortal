import { createBackgroundFailureMonitor, createCentralAlertReporter, createLogger } from "@mis/logger";
import { env } from "./config/env";

const logger = createLogger("student-api");
export const backgroundFailure = createBackgroundFailureMonitor({
  service: "student-api",
  logger,
  report: createCentralAlertReporter("student-api", env.internalApiUrl, env.gatewaySharedSecret),
});
