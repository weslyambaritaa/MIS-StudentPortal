import type { ActiveRoleAuthContext } from "@mis/shared-types";

import { env } from "../../config/env";

const REQUEST_TIMEOUT_MS = 5_000;
const SERVICE_ROUTE_PREFIX = "/api/v1/internal-service";

export class InternalApiUnavailableError extends Error {
  constructor(message = "Internal API is unavailable") {
    super(message);
    this.name = "InternalApiUnavailableError";
  }
}

export class InternalApiResponseError extends Error {
  constructor(readonly status: number) {
    super(`Internal API returned HTTP ${status}`);
    this.name = "InternalApiResponseError";
  }
}

export interface InternalApiRequestOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function resolveTarget(path: string): URL {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError("Internal API path must be an absolute service path");
  }
  const target = new URL(path, env.internalApiUrl);
  const isServiceRoute = target.pathname === SERVICE_ROUTE_PREFIX ||
    target.pathname.startsWith(`${SERVICE_ROUTE_PREFIX}/`);
  if (target.origin !== new URL(env.internalApiUrl).origin || !isServiceRoute) {
    throw new TypeError("Internal API client only permits service-only routes");
  }
  return target;
}

/** Calls Internal API using only the already-validated actor context; incoming browser headers are never copied. */
export async function requestInternalApi<T>(
  path: string,
  actor: ActiveRoleAuthContext,
  options: InternalApiRequestOptions = {},
): Promise<T> {
  const target = resolveTarget(path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl ?? fetch;

  const headers = new Headers({
    "x-service-secret": env.serviceSharedSecret,
    "x-actor-user-id": actor.userId,
    "x-actor-roles": actor.roles.join(","),
    "x-actor-active-role": actor.activeRole,
  });
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  try {
    const response = await fetchImpl(target, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new InternalApiResponseError(response.status);
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch (error) {
    if (error instanceof InternalApiResponseError) throw error;
    if (controller.signal.aborted) throw new InternalApiUnavailableError("Internal API request timed out");
    throw new InternalApiUnavailableError();
  } finally {
    clearTimeout(timeout);
  }
}
