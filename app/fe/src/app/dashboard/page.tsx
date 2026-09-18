"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/providers/keycloak-provider";

function getDashboardTitle(roles: string[]) {
  if (roles.includes("super_admin")) {
    return "Super Admin Dashboard";
  }

  if (roles.includes("admin")) {
    return "Admin Dashboard";
  }

  if (roles.includes("management")) {
    return "Management Dashboard";
  }

  if (roles.includes("finance")) {
    return "Finance Dashboard";
  }

  if (roles.includes("sales")) {
    return "Sales Dashboard";
  }

  if (roles.includes("trainer")) {
    return "Trainer Dashboard";
  }

  if (roles.includes("pic")) {
    return "PIC Dashboard";
  }

  if (roles.includes("student")) {
    return "Student Dashboard";
  }

  return "No Business Role Assigned";
}

export default function DashboardPage() {
  const { keycloak, roles } = useAuth();

  const email = typeof keycloak.tokenParsed?.email === "string" ? keycloak.tokenParsed.email : "";

  const username =
    typeof keycloak.tokenParsed?.preferred_username === "string"
      ? keycloak.tokenParsed.preferred_username
      : "";

  const dashboardTitle = getDashboardTitle(roles);

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold">{dashboardTitle}</h1>

      <div className="mt-6 space-y-2">
        <p>
          <strong>Username:</strong> {username || "-"}
        </p>

        <p>
          <strong>Email:</strong> {email || "-"}
        </p>

        <p>
          <strong>Roles:</strong> {roles.length > 0 ? roles.join(", ") : "-"}
        </p>
      </div>
    </AppShell>
  );
}
