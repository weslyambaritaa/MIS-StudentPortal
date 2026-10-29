"use client";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardWelcomePanel } from "@mis/ui/dashboard-welcome-panel";
import { useAuth } from "@/providers/keycloak-provider";
import { ROLES, type BusinessRole } from "@mis/shared-types";

function getDashboardTitle(role: BusinessRole | null) {
  if (role === ROLES.ADMIN) {
    return "Admin Dashboard";
  }

  if (role === ROLES.MANAGEMENT) {
    return "Management Dashboard";
  }

  if (role === ROLES.FINANCE) {
    return "Finance Dashboard";
  }

  if (role === ROLES.SALES) {
    return "Sales Dashboard";
  }

  if (role === ROLES.TRAINER) {
    return "Trainer Dashboard";
  }

  return "No Business Role Assigned";
}

export default function DashboardPage() {
  const { keycloak, availableRoles, activeRole } = useAuth();

  const email = typeof keycloak.tokenParsed?.email === "string" ? keycloak.tokenParsed.email : "";

  const fullName = typeof keycloak.tokenParsed?.name === "string" ? keycloak.tokenParsed.name : "";

  const username =
    typeof keycloak.tokenParsed?.preferred_username === "string"
      ? keycloak.tokenParsed.preferred_username
      : "";

  const displayName = fullName || username || email || "Pengguna";

  const dashboardTitle = getDashboardTitle(activeRole);

  return (
    <AppShell title="Dashboard">
      <h1 className="text-3xl font-semibold">{dashboardTitle}</h1>

      <DashboardWelcomePanel title={`Halo, selamat datang, ${displayName}!`}>
        <p className="mt-3 text-sm text-zinc-950/60">
          Role Anda: {availableRoles.length > 0 ? availableRoles.join(", ") : "-"}
        </p>
        <p className="mt-1 text-sm text-zinc-950/60">
          Anda sedang menggunakan role: <span className="font-medium text-rose-600">{activeRole ?? "-"}</span>
        </p>
      </DashboardWelcomePanel>
    </AppShell>
  );
}
