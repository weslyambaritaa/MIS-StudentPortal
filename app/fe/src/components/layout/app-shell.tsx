"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PortalShell, type PortalNavigation, type PortalNavigationItem } from "@mis/ui/portal-shell";
import { LordIcon, type LordIconName } from "@mis/ui/lord-icon";
import { ROLES } from "@mis/shared-types";
import { navigationByRole, type NavigationIcon, type NavigationItem } from "@/config/navigation";
import { getSelectableActiveRole } from "@/lib/auth/active-role";
import { useAuth } from "@/providers/keycloak-provider";
import { NotificationsControl } from "./notifications-control";

type AppShellProps = { children: ReactNode; title?: string };

/**
 * LordIcon mapping for Sales sidebar items.
 * User requested placeholder icons for every button/link on the Sales sidebar.
 */
const departmentLordIcons: Record<string, LordIconName> = {
  // Sales specific keys
  quotation: "pen-nib",
  "request-form": "receipt",
  "registration-form": "file-text",
  industry: "briefcase",
  account: "building",
  "person-in-charge": "avatar-circle",

  // Admin specific keys
  "booking-room": "calendar-dots",
  "training-calendar": "calendar-check",
  "generate-certificate": "badge-check",
  "manage-notifications": "bell",
  "account-credentials": "shield-check",
  "personal-account-links": "building",
  "list-training": "book",
  "training-room": "building",
  "course-category": "puzzle-piece",
  "access-logs": "clock",

  // Finance specific keys
  "due-date": "calendar-dots",
  "invoice-list": "receipt",
  "private-invoice": "file-text",
  "public-invoice": "file-text",

  // Trainer specific keys
  "my-class-list": "book",
  "finished-class": "check-circle",
  "monitor-class": "desktop-alt",
  "trainer-calendar": "calendar-dots",
};

const navigationIconLordMap: Record<NavigationIcon, LordIconName> = {
  dashboard: "bar-chart-vertical",
  file: "file-text",
  clipboard: "check-list",
  business: "briefcase",
  account: "building",
  people: "users",
  student: "student-cap",
  course: "book",
  category: "puzzle-piece",
  room: "building",
  calendar: "calendar-dots",
  certificate: "badge-check",
  notification: "bell",
  credentials: "shield-check",
  audit: "clock",
  complete: "check-circle",
  monitor: "desktop-alt",
  profile: "avatar-circle",
  remote: "compass",
  path: "compass",
  report: "arrow-trending-up",
  matrix: "check-list",
};

function asPortalItem(item: NavigationItem): PortalNavigationItem {
  const iconName = departmentLordIcons[item.key] ?? navigationIconLordMap[item.icon] ?? "briefcase";
  return {
    ...item,
    icon: ({ active }) => (
      <LordIcon
        src={iconName}
        size={20}
        trigger="hover"
        target="a,button"
        colors={active ? "primary:#ffffff,secondary:#ffffff" : "primary:#4b5563,secondary:#9ca3af"}
        className={active ? "" : "transition-colors duration-150 group-hover:[--lord-icon-primary:#de1641] group-hover:[--lord-icon-secondary:#de1641]"}
      />
    ),
  };
}

function getNavigation(activeRole: ReturnType<typeof useAuth>["activeRole"], includeAccessLogs: boolean): PortalNavigation {
  const configured = activeRole ? navigationByRole[activeRole] : null;
  const sections = (configured?.sections ?? []).map((section) => ({
    title: section.title,
    items: section.items.map((item) => asPortalItem(item)),
  }));
  if (includeAccessLogs) {
    sections.push({
      title: "Administration",
      items: [
        asPortalItem({
          key: "access-logs",
          label: "Access Logs",
          icon: "audit",
          href: "/admin/access-logs",
        }),
      ],
    });
  }
  return {
    ...(configured?.dashboard ? { dashboard: asPortalItem(configured.dashboard) } : {}),
    ...(configured?.dashboardSectionTitle ? { dashboardSectionTitle: configured.dashboardSectionTitle } : {}),
    ...(configured?.dashboardSectionItems ? { dashboardSectionItems: configured.dashboardSectionItems.map((item) => asPortalItem(item)) } : {}),
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
