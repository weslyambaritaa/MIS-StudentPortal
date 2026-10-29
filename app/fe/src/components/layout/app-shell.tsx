"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Award, Bell, BookOpen, Briefcase, Building2, CalendarDays, ChartNetwork,
  CheckCircle2, ClipboardCheck, ClipboardList, FileText, FlaskConical,
  GraduationCap, History, Home, KeyRound, Layers, Monitor, Network, User,
  Users, type LucideIcon,
} from "lucide-react";
import { PortalShell, type PortalNavigation, type PortalNavigationItem } from "@mis/ui/portal-shell";
import { ROLES } from "@mis/shared-types";
import { navigationByRole, type NavigationIcon, type NavigationItem } from "@/config/navigation";
import { getSelectableActiveRole } from "@/lib/auth/active-role";
import { useAuth } from "@/providers/keycloak-provider";
import { NotificationsControl } from "./notifications-control";

type AppShellProps = { children: ReactNode; title?: string };

const navigationIcons: Record<NavigationIcon, LucideIcon> = {
  dashboard: Home,
  file: FileText,
  clipboard: ClipboardList,
  business: Briefcase,
  account: Building2,
  people: Users,
  student: GraduationCap,
  course: BookOpen,
  category: Layers,
  room: Building2,
  calendar: CalendarDays,
  certificate: Award,
  notification: Bell,
  credentials: KeyRound,
  audit: History,
  complete: CheckCircle2,
  monitor: Monitor,
  profile: User,
  remote: FlaskConical,
  path: Network,
  report: ChartNetwork,
  matrix: ClipboardCheck,
};

function asPortalItem(item: NavigationItem): PortalNavigationItem {
  const Icon = navigationIcons[item.icon];
  return { ...item, icon: <Icon size={20} strokeWidth={1.7} /> };
}

function getNavigation(activeRole: ReturnType<typeof useAuth>["activeRole"], includeAccessLogs: boolean): PortalNavigation {
  const configured = activeRole ? navigationByRole[activeRole] : null;
  const sections = (configured?.sections ?? []).map((section) => ({ title: section.title, items: section.items.map(asPortalItem) }));
  if (includeAccessLogs) sections.push({ title: "Administration", items: [{ key: "access-logs", label: "Access Logs", icon: <History size={20} strokeWidth={1.7} />, href: "/admin/access-logs" }] });
  return {
    ...(configured?.dashboard ? { dashboard: asPortalItem(configured.dashboard) } : {}),
    ...(configured?.dashboardSectionTitle ? { dashboardSectionTitle: configured.dashboardSectionTitle } : {}),
    ...(configured?.dashboardSectionItems ? { dashboardSectionItems: configured.dashboardSectionItems.map(asPortalItem) } : {}),
    sections,
  };
}

export function AppShell({ children, title = "Dashboard" }: AppShellProps) {
  const { keycloak, availableRoles, activeRole, setActiveRole, hasAccessLogAdminRole } = useAuth();
  const router = useRouter();
  const name = [keycloak.tokenParsed?.name, keycloak.tokenParsed?.preferred_username, keycloak.tokenParsed?.email]
    .find((value): value is string => typeof value === "string" && value.length > 0) ?? "-";

  return <PortalShell
    title={title}
    navigation={getNavigation(activeRole, hasAccessLogAdminRole)}
    userName={name}
    activeRole={activeRole}
    availableRoles={availableRoles}
    onRoleChange={(role) => {
      const selected = getSelectableActiveRole(availableRoles, role);
      if (selected) {
        setActiveRole(selected);
        router.replace("/dashboard");
      }
    }}
    roleLabel={(role) => role === ROLES.ADMIN ? "Admin" : role[0].toUpperCase() + role.slice(1)}
    onLogout={() => void keycloak.logout({ redirectUri: `${window.location.origin}/dashboard` })}
    headerActions={<NotificationsControl />}
  >{children}</PortalShell>;
}
