import { env } from "../../config/env";
import { sendFailureAlert } from "./failure-alert.service";
import { logger } from "./logger";

const targets = [
  { name: "API Gateway", url: process.env.MONITOR_GATEWAY_HEALTH_URL ?? "http://api-gateway:4000/health" },
  { name: "Internal API and database", url: process.env.MONITOR_INTERNAL_HEALTH_URL ?? "http://internal-api:4002/health" },
  { name: "Student API and database", url: process.env.MONITOR_STUDENT_HEALTH_URL ?? "http://student-api:4001/health" },
  { name: "Keycloak", url: process.env.MONITOR_KEYCLOAK_HEALTH_URL ?? "http://keycloak:8080/realms/mis-student-portal" },
];
const intervalMs = Number(process.env.MONITOR_INTERVAL_MS ?? 30_000);
const failureThreshold = Number(process.env.MONITOR_FAILURE_THRESHOLD ?? 2);
const startupGraceMs = Number(process.env.MONITOR_STARTUP_GRACE_MS ?? 90_000);
const startedAt = Date.now();
const failureCounts = new Map<string, number>();
const activeIncidents = new Set<string>();

async function checkTarget(target: typeof targets[number]) {
  let failure: string | undefined;
  try {
    const response = await fetch(target.url, { signal: AbortSignal.timeout(5_000) });
    const body = await response.json().catch(() => null) as { status?: string; database?: string } | null;
    if (body?.database === "disconnected") failure = "Database is unavailable";
    else if (body?.status === "error") failure = "Health check reported an error";
    else if (!response.ok) failure = `Health check returned HTTP ${response.status}`;
  } catch (error) {
    failure = error instanceof Error ? error.message : "Health check failed";
  }

  if (failure) {
    const count = (failureCounts.get(target.name) ?? 0) + 1;
    failureCounts.set(target.name, count);
    if (Date.now() - startedAt >= startupGraceMs && count >= failureThreshold && !activeIncidents.has(target.name)) {
      logger.fatal({ target: target.name, url: target.url, failure, consecutiveFailures: count }, "Critical service outage detected");
      try {
        await sendFailureAlert({
          service: target.name,
          requestId: `health-${Date.now()}`,
          method: "GET",
          path: new URL(target.url).pathname,
          statusCode: 503,
          occurrences: count,
          windowMinutes: Math.max(1, Math.ceil((intervalMs * count) / 60_000)),
          summary: failure,
        });
        activeIncidents.add(target.name);
      } catch (error) {
        logger.error({ err: error, target: target.name }, "Service outage notification failed");
      }
    }
    return;
  }

  failureCounts.set(target.name, 0);
  if (activeIncidents.delete(target.name)) logger.info({ target: target.name }, "Service health recovered");
}

async function poll() {
  await Promise.all(targets.map(checkTarget));
}

logger.info({ targets: targets.map(({ name }) => name), intervalMs, failureThreshold, recipientConfigured: Boolean(env.developerSupportEmail) }, "System health monitoring started");
void poll();
setInterval(() => void poll(), intervalMs);
