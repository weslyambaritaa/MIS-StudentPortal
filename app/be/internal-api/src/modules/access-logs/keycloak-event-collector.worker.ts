import { createHash } from "node:crypto";
import { sequelize } from "../../database/sequelize";
import { KeycloakEventSyncCheckpoint, SecurityAccessLog } from "../../database/models";
import { env } from "../../config/env";
import { backgroundFailure } from "../monitoring/background-failure";

const PAGE_SIZE = 100;
const OVERLAP_MS = 5 * 60 * 1000;
const INITIAL_LOOKBACK_MS = 24 * 60 * 60 * 1000;

type KeycloakEvent = {
  time?: number;
  type?: string;
  realmId?: string;
  clientId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  error?: string;
  authDetails?: { userId?: string; clientId?: string; ipAddress?: string; realmId?: string };
  operationType?: string;
  resourceType?: string;
  resourcePath?: string;
  representation?: string;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function eventKey(source: string, event: KeycloakEvent): string {
  return `${source}:${createHash("sha256").update(stableJson(event)).digest("hex")}`;
}

function normalizedEvent(source: "KEYCLOAK_USER" | "KEYCLOAK_ADMIN", event: KeycloakEvent) {
  if (!Number.isFinite(event.time)) throw new Error(`Keycloak ${source} event has no valid timestamp`);
  const admin = source === "KEYCLOAK_ADMIN";
  const actor = admin ? event.authDetails?.userId : event.userId;
  const ip = admin ? event.authDetails?.ipAddress : event.ipAddress;
  const targetId = admin ? event.resourcePath?.split("/").filter(Boolean).at(-1) ?? null : event.userId ?? null;
  const details = admin
    ? { operationType: event.operationType ?? null, resourcePath: event.resourcePath ?? null, error: event.error ?? null }
    : { clientId: event.clientId ?? null, error: event.error ?? null };

  return {
    event_key: eventKey(source, event),
    occurred_at: new Date(event.time!),
    actor_subject: actor ?? null,
    actor_type: admin ? "ADMIN" : "USER",
    active_role: null,
    event_type: admin
      ? `ADMIN_${event.operationType ?? "UNKNOWN"}_${event.resourceType ?? "RESOURCE"}`.slice(0, 100)
      : (event.type ?? "UNKNOWN").slice(0, 100),
    object_type: admin ? event.resourceType ?? null : "USER",
    object_id: targetId,
    ip_address: ip ?? null,
    source_system: source,
    outcome: event.error ? "FAILURE" : "SUCCESS",
    request_id: event.sessionId ?? null,
    // Deliberately exclude Keycloak event details and admin representation; they can contain PII or secrets.
    details: JSON.stringify(details),
    received_at: new Date(),
  };
}

async function fetchClientToken(): Promise<string> {
  if (!env.keycloakAuditClientSecret) throw new Error("KEYCLOAK_AUDIT_CLIENT_SECRET is required when audit collection is enabled");
  const endpoint = `${env.keycloakUrl.replace(/\/$/, "")}/realms/${encodeURIComponent(env.keycloakRealm)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.keycloakAuditClientId,
    client_secret: env.keycloakAuditClientSecret,
  });
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Keycloak audit token request failed with status ${response.status}`);
  const tokenResponse = await response.json() as { access_token?: string };
  if (!tokenResponse.access_token) throw new Error("Keycloak audit token response did not include an access token");
  return tokenResponse.access_token;
}

async function fetchEventWindow(token: string, sourcePath: "events" | "admin-events", from: number, to: number): Promise<KeycloakEvent[]> {
  const collected: KeycloakEvent[] = [];
  for (let first = 0; ; first += PAGE_SIZE) {
    const endpoint = new URL(`${env.keycloakUrl.replace(/\/$/, "")}/admin/realms/${encodeURIComponent(env.keycloakRealm)}/${sourcePath}`);
    endpoint.searchParams.set("dateFrom", String(from));
    endpoint.searchParams.set("dateTo", String(to));
    endpoint.searchParams.set("direction", "asc");
    endpoint.searchParams.set("first", String(first));
    endpoint.searchParams.set("max", String(PAGE_SIZE));
    const response = await fetch(endpoint, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Keycloak ${sourcePath} query failed with status ${response.status}`);
    const page = await response.json() as KeycloakEvent[];
    if (!Array.isArray(page)) throw new Error(`Keycloak ${sourcePath} response was not a list`);
    collected.push(...page);
    if (page.length < PAGE_SIZE) return collected;
    if (first >= 10_000) throw new Error(`Keycloak ${sourcePath} query exceeded safety page limit`);
  }
}

async function importSource(source: "KEYCLOAK_USER" | "KEYCLOAK_ADMIN", token: string, now: Date): Promise<number> {
  const path = source === "KEYCLOAK_USER" ? "events" : "admin-events";
  const checkpoint = await KeycloakEventSyncCheckpoint.findByPk(source);
  const cursor = checkpoint?.last_seen_at.getTime() ?? now.getTime() - INITIAL_LOOKBACK_MS;
  const from = Math.max(0, cursor - OVERLAP_MS);
  const events = await fetchEventWindow(token, path, from, now.getTime());
  const normalized = events.map((event) => normalizedEvent(source, event));

  return sequelize.transaction(async (transaction) => {
    for (const event of normalized) {
      await SecurityAccessLog.findOrCreate({ where: { event_key: event.event_key }, defaults: event, transaction });
      if (source === "KEYCLOAK_USER" && event.event_type === "LOGIN" && event.outcome === "SUCCESS" && event.actor_subject) {
        await sequelize.query(
          "UPDATE student_master_profile SET first_login_at = COALESCE(first_login_at, :occurredAt), last_login_at = CASE WHEN last_login_at IS NULL OR last_login_at < :occurredAt THEN :occurredAt ELSE last_login_at END, updated_at = CURRENT_TIMESTAMP WHERE keycloak_subject = :subject",
          { replacements: { subject: event.actor_subject, occurredAt: event.occurred_at }, transaction },
        );
      }
    }
    if (checkpoint) {
      await checkpoint.update({ last_seen_at: now, updated_at: now }, { transaction });
    } else {
      await KeycloakEventSyncCheckpoint.create({ source_system: source, last_seen_at: now, updated_at: now }, { transaction });
    }
    return normalized.length;
  });
}

export async function collectKeycloakAccessEvents(now = new Date()): Promise<number> {
  if (!env.keycloakAuditEnabled) return 0;
  const token = await fetchClientToken();
  const userCount = await importSource("KEYCLOAK_USER", token, now);
  const adminCount = await importSource("KEYCLOAK_ADMIN", token, now);
  return userCount + adminCount;
}

export function startKeycloakEventCollector(): () => void {
  if (!env.keycloakAuditEnabled) return () => undefined;
  if (!env.keycloakAuditClientSecret || !Number.isSafeInteger(env.keycloakAuditPollIntervalMs) || env.keycloakAuditPollIntervalMs < 10_000) {
    throw new Error("Keycloak audit collection is enabled but its secret or polling interval is invalid");
  }
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    void collectKeycloakAccessEvents().then((count) => {
      backgroundFailure.clear("keycloak-event-collector");
      if (count > 0) console.info(`Collected ${count} Keycloak audit events`);
    }).catch((error: unknown) => {
      backgroundFailure.record("keycloak-event-collector", error);
    }).finally(() => { running = false; });
  };
  run();
  const timer = setInterval(run, env.keycloakAuditPollIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
