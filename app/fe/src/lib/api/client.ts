import type { BusinessRole } from "@mis/shared-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://api.localhost:4000";

export async function apiRequest<T>(
  path: string,
  accessToken: string,
  activeRole: BusinessRole,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      "X-Active-Role": activeRole,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    let message = `API request failed: ${response.status}`;
    if (body) {
      try {
        const payload = JSON.parse(body) as { message?: unknown };
        if (typeof payload.message === "string" && payload.message.trim()) message = payload.message;
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
