import type { BusinessRole } from "@mis/shared-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://api.localhost:4000";

export async function apiRequest<T>(
  path: string,
  accessToken: string,
  activeRole: BusinessRole,
  init: RequestInit = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      // API responses are user- and role-specific. Avoid conditional browser
      // requests (304) across the separate api.localhost origin.
      cache: init.cache ?? "no-store",
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
        "X-Active-Role": activeRole,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("We couldn't connect to the service. Check your connection and try again. If the problem continues, contact Developer Support.");
  }

  if (!response.ok) {
    const body = await response.text();
    let message = `The request could not be completed (HTTP ${response.status}).`;
    if (body) {
      try {
        const payload = JSON.parse(body) as { error?: { code?: unknown; message?: unknown; requestId?: unknown }; message?: unknown };
        const apiMessage = payload.error?.message ?? payload.message;
        const requestId = payload.error?.requestId;
        if (typeof apiMessage === "string" && apiMessage.trim()) message = apiMessage;
        if (typeof requestId === "string" && requestId.trim()) message += ` (Reference: ${requestId})`;
      } catch {
        // Keep the status-based message when the server returns non-JSON text.
      }
    }
    throw new Error(message);
  }

  // DELETE endpoints may legitimately return 204 No Content. Do not ask the
  // browser to parse an empty response body as JSON.
  if (response.status === 204) return undefined as T;

  const body = await response.text();
  return body ? (JSON.parse(body) as T) : (undefined as T);
}
