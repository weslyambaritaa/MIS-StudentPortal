"use client";

import { useSession } from "next-auth/react";
import { apiRequest } from "@/lib/api/client";

export function useApi() {
  const { data: session } = useSession();

  return async function request<T>(path: string, init?: RequestInit) {
    if (!session?.accessToken) throw new Error("No access token available");
    return apiRequest<T>(path, session.accessToken, init);
  };
}
