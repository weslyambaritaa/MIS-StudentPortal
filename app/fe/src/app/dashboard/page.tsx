"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/providers/keycloak-provider";

export default function DashboardPage() {
  const { keycloak, roles } = useAuth();

  const email = typeof keycloak.tokenParsed?.email === "string" ? keycloak.tokenParsed.email : "";

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold">Welcome</h1>

      <p className="mt-2">Welcome to MIS Student Portal.</p>

      <p className="mt-4 text-sm text-gray-600">{email}</p>

      <p className="mt-2 text-sm text-gray-600">Role: {roles.join(", ")}</p>
    </AppShell>
  );
}
