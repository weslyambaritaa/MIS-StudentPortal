"use client";

import { useCallback } from "react";
import { useAuth } from "@/providers/keycloak-provider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://api.localhost:4000";

export function useAdminApi() {
  const { keycloak, hasAccessLogAdminRole } = useAuth();

  return useCallback(async function adminRequest(path: string, init: RequestInit = {}) {
    if (!hasAccessLogAdminRole) throw new Error("Akses administrasi Keycloak diperlukan");
    try {
      await keycloak.updateToken(30);
    } catch {
      await keycloak.login();
      throw new Error("Sesi berakhir; silakan login kembali");
    }
    if (!keycloak.token) throw new Error("Token akses tidak tersedia");

    return fetch(`${API_BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...init.headers,
        Authorization: `Bearer ${keycloak.token}`,
      },
    });
  }, [hasAccessLogAdminRole, keycloak]);
}
