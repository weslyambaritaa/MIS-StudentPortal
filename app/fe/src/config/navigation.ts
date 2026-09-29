import { BUSINESS_ROLES, ROLES, type BusinessRole } from "@mis/shared-types";

export type NavigationItem = {
  label: string;
  href: string;
  icon: "dashboard";
};

export type RoleNavigation = {
  dashboard: NavigationItem;
  sections: readonly { title: string; items: readonly NavigationItem[] }[];
  routes: readonly string[];
};

const dashboardItem: NavigationItem = {
  label: "Dashboard",
  href: "/dashboard",
  icon: "dashboard",
};

const currentRoutes = ["/dashboard", "/components-preview"] as const;
const currentNavigation: RoleNavigation = {
  dashboard: dashboardItem,
  sections: [],
  routes: currentRoutes,
};

/** Add a navigation item only when its destination page exists in the frontend. */
export const navigationByRole: Record<BusinessRole, RoleNavigation> = {
  [ROLES.STUDENT]: currentNavigation,
  [ROLES.PIC]: currentNavigation,
  [ROLES.TRAINER]: currentNavigation,
  [ROLES.SALES]: currentNavigation,
  [ROLES.ADMIN]: currentNavigation,
  [ROLES.FINANCE]: currentNavigation,
  [ROLES.MANAGEMENT]: currentNavigation,
};

const businessFrontendRoutes = Array.from(
  new Set(BUSINESS_ROLES.flatMap((role) => navigationByRole[role].routes)),
);

export const knownFrontendRoutes: readonly string[] = [
  ...businessFrontendRoutes,
  "/no-access",
];
