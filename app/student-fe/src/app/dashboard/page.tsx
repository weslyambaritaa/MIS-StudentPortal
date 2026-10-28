"use client";

import { StudentPortalShell } from "@/components/student-portal-shell";
import { useStudentPortalAuth } from "@/providers/student-portal-auth-provider";
import { DashboardWelcomePanel } from "@mis/ui/dashboard-welcome-panel";

export default function DashboardPage() {
  const { keycloak, activeRole } = useStudentPortalAuth();
  const name = keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username || keycloak.tokenParsed?.email || "User";
  const title = activeRole === "pic" ? "PIC Dashboard" : "Student Dashboard";

  return (
    <StudentPortalShell title="Dashboard">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <DashboardWelcomePanel title={`Welcome, ${name}!`}>
        <p className="mt-3 text-sm text-zinc-950/60">You are signed in to the Student Portal as {activeRole?.toUpperCase()}.</p>
      </DashboardWelcomePanel>
    </StudentPortalShell>
  );
}
