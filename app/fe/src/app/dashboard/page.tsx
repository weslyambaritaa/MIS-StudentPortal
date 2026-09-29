"use client";

import { AppShell } from "@/components/layout/app-shell";
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

  if (role === ROLES.PIC) {
    return "PIC Dashboard";
  }

  if (role === ROLES.STUDENT) {
    return "Student Dashboard";
  }

  return "No Business Role Assigned";
}

export default function DashboardPage() {
  const { keycloak, availableRoles, activeRole } = useAuth();

  const email = typeof keycloak.tokenParsed?.email === "string" ? keycloak.tokenParsed.email : "";

  const username =
    typeof keycloak.tokenParsed?.preferred_username === "string"
      ? keycloak.tokenParsed.preferred_username
      : "";

  const dashboardTitle = getDashboardTitle(activeRole);

  return (
    <AppShell title="Dashboard">
      <h1 className="text-3xl font-semibold">{dashboardTitle}</h1>

      <div className="mt-6 space-y-2">
        <p>
          <strong>Username:</strong> {username || "-"}
        </p>

        <p>
          <strong>Email:</strong> {email || "-"}
        </p>

        <p>
          <strong>Roles:</strong> {availableRoles.length > 0 ? availableRoles.join(", ") : "-"}
        </p>

        <p>
          <strong>Active role:</strong> {activeRole ?? "-"}
        </p>
      </div>
    </AppShell>
  );
}
