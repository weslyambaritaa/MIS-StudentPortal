"use client";

import { useAuth } from "@/providers/keycloak-provider";
import { apiRequest } from "@/lib/api/client";

export function useApi() {
  const { keycloak } = useAuth();

  return async function request<T>(path: string, init?: RequestInit) {
    try {
      await keycloak.updateToken(30);
    } catch {
      await keycloak.login();
      throw new Error("Session expired");
    }

    if (!keycloak.token) {
      throw new Error("No Keycloak access token available");
    }

    return apiRequest<T>(path, keycloak.token, init);
  };
}
