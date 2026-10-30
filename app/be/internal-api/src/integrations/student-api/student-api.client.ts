import type { ActiveRoleAuthContext } from "@mis/shared-types";
import { AppError } from "../../errors/app-error";
import { env } from "../../config/env";

const PREFIX = "/api/v1/internal-service/pics";

export type PicAssignmentRecord = {
  id: string;
  account_id: string;
  assigned_at: string | Date;
  ended_at: string | Date | null;
  assigned_by_subject: string | null;
  ended_by_subject: string | null;
};

export type PicRecord = {
  id: string;
  keycloak_subject: string;
  name: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "INACTIVE";
  activation_expires_at: string | Date | null;
  position: string;
  created_at: string | Date;
  updated_at: string | Date;
  assignments: PicAssignmentRecord[];
};

export class StudentApiError extends AppError {
  constructor(readonly status: number, message: string) {
    super(status, message);
    this.name = "StudentApiError";
  }
}

async function requestStudentApi<T>(path: string, actor: ActiveRoleAuthContext, options: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!path.startsWith(`${PREFIX}`) || path.startsWith("//")) throw new TypeError("Student API path is outside the PIC service boundary");
  const base = new URL(env.studentApiUrl);
  const target = new URL(path, base);
  if (target.origin !== base.origin) throw new TypeError("Student API target must use its configured origin");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const headers = new Headers({
      "x-service-secret": env.serviceSharedSecret,
      "x-actor-user-id": actor.userId,
      "x-actor-user-email": actor.email ?? "",
      "x-actor-roles": actor.roles.join(","),
      "x-actor-active-role": actor.activeRole,
    });
    if (options.body !== undefined) headers.set("content-type", "application/json");
    const response = await fetch(target, { method: options.method ?? "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
      const message = payload.error?.message ?? payload.message ?? "Student API request failed";
      throw new StudentApiError(response.status, message);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch (error) {
    if (error instanceof StudentApiError) throw error;
    if (controller.signal.aborted) throw new StudentApiError(503, "Student service request timed out");
    throw new StudentApiError(503, "Student service is unavailable");
  } finally {
    clearTimeout(timer);
  }
}

export const studentPicClient = {
  async list(actor: ActiveRoleAuthContext, filters: { id?: string; profileIds?: string[]; accountId?: string; accountIds?: string[]; status?: string; search?: string } = {}) {
    const query = new URLSearchParams();
    if (filters.id) query.set("id", filters.id);
    if (filters.profileIds?.length) query.set("profileIds", filters.profileIds.join(","));
    if (filters.accountId) query.set("accountId", filters.accountId);
    if (filters.accountIds?.length) {
      const ids = filters.accountIds.filter(Boolean);
      if (ids.length) query.set("accountIds", ids.join(","));
    }
    if (filters.status && filters.status !== "ALL") query.set("status", filters.status);
    if (filters.search) query.set("search", filters.search);
    const suffix = query.size ? `?${query}` : "";
    return requestStudentApi<{ items: PicRecord[] }>(`${PREFIX}/${suffix}`, actor);
  },
  async get(actor: ActiveRoleAuthContext, id: string) {
    const response = await requestStudentApi<{ items: PicRecord[] }>(`${PREFIX}?id=${encodeURIComponent(id)}`, actor);
    return response.items[0] ?? null;
  },
  async create(actor: ActiveRoleAuthContext, body: { id: string; keycloakSubject: string; name: string; email: string; position: string; status: PicRecord["status"]; activationExpiresAt: string | null; accountId: string; assignedBySubject: string }) {
    return requestStudentApi<{ item: PicRecord }>(PREFIX, actor, { method: "POST", body });
  },
  async update(actor: ActiveRoleAuthContext, id: string, body: { name?: string; status?: PicRecord["status"]; activationExpiresAt?: string | null }) {
    return requestStudentApi<{ item: PicRecord }>(`${PREFIX}/${encodeURIComponent(id)}`, actor, { method: "PATCH", body });
  },
  async delete(actor: ActiveRoleAuthContext, id: string) {
    return requestStudentApi<void>(`${PREFIX}/${encodeURIComponent(id)}`, actor, { method: "DELETE" });
  },
  async endAccountAssignments(actor: ActiveRoleAuthContext, accountId: string) {
    return requestStudentApi<{ ended: number }>(`${PREFIX}/accounts/${encodeURIComponent(accountId)}/assignments`, actor, { method: "DELETE" });
  },
};

