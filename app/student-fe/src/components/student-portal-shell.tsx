"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, CalendarDays, ChartNoAxesColumn, CheckSquare, ClipboardList,
  FlaskConical, Home, Monitor, Network, UserRound, UsersRound,
} from "lucide-react";
import { PortalShell, type PortalNavigation } from "@mis/ui/portal-shell";
import { ROLES } from "@mis/shared-types";
import { useStudentPortalAuth } from "@/providers/student-portal-auth-provider";

const studentNavigation: PortalNavigation = {
  dashboard: { key: "dashboard", label: "Dashboard", icon: <Home size={20} strokeWidth={1.7} />, href: "/dashboard" },
  sections: [
    { title: "Student Portal", items: [
      { key: "attendance", label: "Attendance", icon: <CalendarDays size={20} strokeWidth={1.7} />, disabled: true },
      { key: "evaluation-form", label: "Evaluation Form", icon: <CheckSquare size={20} strokeWidth={1.7} />, disabled: true },
      { key: "course-history", label: "Course History", icon: <BookOpen size={20} strokeWidth={1.7} />, disabled: true },
      { key: "e-learning", label: "E-Learning", icon: <Monitor size={20} strokeWidth={1.7} />, disabled: true },
      { key: "remote-lab", label: "Remote Lab", icon: <FlaskConical size={20} strokeWidth={1.7} />, disabled: true },
      { key: "my-profile", label: "My Profile", icon: <UserRound size={20} strokeWidth={1.7} />, disabled: true },
      { key: "pre-post-test", label: "Pre / Post Test", icon: <ClipboardList size={20} strokeWidth={1.7} />, disabled: true },
      { key: "learning-path", label: "Learning Path", icon: <Network size={20} strokeWidth={1.7} />, disabled: true },
    ] },
    { title: "PIC Portal", items: [
      { key: "training-account", label: "Training Account", icon: <UsersRound size={20} strokeWidth={1.7} />, disabled: true },
      { key: "training-report", label: "Training Report", icon: <ClipboardList size={20} strokeWidth={1.7} />, disabled: true },
      { key: "skill-matrix", label: "Skill Matrix", icon: <ChartNoAxesColumn size={20} strokeWidth={1.7} />, disabled: true },
    ] },
  ],
};

export function StudentPortalShell({ children, title = "Dashboard" }: { children: ReactNode; title?: string }) {
  const { keycloak, availableRoles, activeRole, setActiveRole } = useStudentPortalAuth();
  const router = useRouter();
  const userName = keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username || keycloak.tokenParsed?.email || "-";

  const navigation: PortalNavigation = {
    ...studentNavigation,
    sections: studentNavigation.sections.filter((section) => section.title === "Student Portal" ? activeRole === ROLES.STUDENT : activeRole === ROLES.PIC),
  };

  return <PortalShell
    title={title}
    navigation={navigation}
    userName={userName}
    activeRole={activeRole}
    availableRoles={availableRoles}
    onRoleChange={(role) => {
      const selected = availableRoles.find((candidate) => candidate === role);
      if (selected) {
        setActiveRole(selected);
        router.replace("/dashboard");
      }
    }}
    roleLabel={(role) => role[0].toUpperCase() + role.slice(1)}
    onLogout={() => void keycloak.logout({ redirectUri: `${window.location.origin}/dashboard` })}
  >{children}</PortalShell>;
}
