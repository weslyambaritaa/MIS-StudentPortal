import { createBackgroundFailureMonitor } from "@mis/logger";
import { sendFailureAlert } from "./failure-alert.service";
import { logger } from "./logger";

export const backgroundFailure = createBackgroundFailureMonitor({ service: "internal-api", logger, report: sendFailureAlert });
