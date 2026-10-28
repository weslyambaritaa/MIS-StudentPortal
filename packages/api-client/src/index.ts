import type { BusinessRole } from "@mis/shared-types";

export type ApiRequest = <T>(
  path: string,
  accessToken: string,
  activeRole: BusinessRole,
  init?: RequestInit,
) => Promise<T>;

/** Create a browser API client using an app-specific, public API base URL. */
export function createApiClient(apiBaseUrl: string): ApiRequest {
  return async function apiRequest<T>(
    path: string,
    accessToken: string,
    activeRole: BusinessRole,
    init: RequestInit = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        ...init,
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
      let message = response.status === 401
        ? "Your session has expired. Please sign in again."
        : response.status === 403
          ? "You don't have permission to perform this action."
          : response.status === 404
            ? "The requested information could not be found."
            : "We couldn't complete your request. Please try again.";
      if (body) {
        try {
          const payload = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
          const apiMessage = payload.error?.message ?? payload.message;
          if (typeof apiMessage === "string" && apiMessage.trim()) message = apiMessage;
        } catch {
          // Keep the status-based message when the server returns non-JSON text.
        }
      }
      throw new Error(message);
    }

    if (response.status === 204) return undefined as T;
    const body = await response.text();
    return body ? JSON.parse(body) as T : undefined as T;
  };
}
