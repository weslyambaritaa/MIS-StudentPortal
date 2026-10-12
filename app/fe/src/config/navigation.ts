import { BUSINESS_ROLES, ROLES, type BusinessRole } from "@mis/shared-types";

export type NavigationIcon =
  | "dashboard"
  | "file"
  | "clipboard"
  | "business"
  | "account"
  | "people"
  | "student"
  | "course"
  | "category"
  | "room"
  | "calendar"
  | "certificate"
  | "notification"
  | "credentials"
  | "audit"
  | "complete"
  | "monitor"
  | "profile"
  | "remote"
  | "path"
  | "report"
  | "matrix";

export type NavigationItem = {
  key: string;
  label: string;
  icon: NavigationIcon;
  /** Absent for a planned feature whose page is not implemented yet. */
  href?: string;
  disabled?: boolean;
};

export type NavigationPlacement =
  | { kind: "dashboard"; sectionTitle?: string }
  | { kind: "dashboard-item" }
  | { kind: "section"; title: string };

/**
 * Static RBAC feature registry: each feature declares the business roles that
 * can see/use it, its implemented route (if any), and its sidebar placement.
 * This is not a runtime permission system; menu and frontend route UX are
 * derived from the same role-to-feature source.
 */
export type FeatureAccessEntry = {
  key: string;
  label: string;
  labelByRole?: Partial<Record<BusinessRole, string>>;
  icon: NavigationIcon;
  roles: readonly BusinessRole[];
  route?: string;
  placementByRole?: Partial<Record<BusinessRole, NavigationPlacement>>;
};

export type RoleNavigation = {
  dashboard: NavigationItem;
  dashboardSectionTitle?: string;
  dashboardSectionItems?: readonly NavigationItem[];
  sections: readonly { title: string; items: readonly NavigationItem[] }[];
  routes: readonly string[];
};

const comingSoon = (
  key: string,
  label: string,
  icon: NavigationIcon,
  roles: readonly BusinessRole[],
  section: string,
): FeatureAccessEntry => ({
  key,
  label,
  icon,
  roles,
  placementByRole: Object.fromEntries(roles.map((role) => [role, { kind: "section", title: section }])) as Partial<
    Record<BusinessRole, NavigationPlacement>
  >,
});

const feature = (
  key: string,
  label: string,
  icon: NavigationIcon,
  roles: readonly BusinessRole[],
  placementByRole: Partial<Record<BusinessRole, NavigationPlacement>>,
): FeatureAccessEntry => ({ key, label, icon, roles, placementByRole });

/**
 * Role-to-feature access matrix. Add a route here only when its real page is
 * implemented; future sidebar entries intentionally have no route and remain
 * disabled in the UI.
 */
export const FEATURE_ACCESS_MATRIX: readonly FeatureAccessEntry[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    labelByRole: {
      [ROLES.TRAINER]: "Trainer Dashboard",
      [ROLES.STUDENT]: "Student Dashboard",
      [ROLES.PIC]: "PIC Dashboard",
    },
    icon: "dashboard",
    roles: BUSINESS_ROLES,
    route: "/dashboard",
    placementByRole: Object.fromEntries(
      BUSINESS_ROLES.map((role) => [
        role,
        { kind: "dashboard", ...(role === ROLES.FINANCE ? { sectionTitle: "Monitoring" } : {}) },
      ]),
    ) as Partial<Record<BusinessRole, NavigationPlacement>>,
  },
  {
    key: "components-preview",
    label: "Components Preview",
    icon: "dashboard",
    roles: BUSINESS_ROLES,
    route: "/components-preview",
  },

  // Sales
  { key: "quotation", label: "Quotation", icon: "file", roles: [ROLES.SALES], route: "/sales/quotation", placementByRole: { [ROLES.SALES]: { kind: "section", title: "Main Feature" } } },
  comingSoon("request-form", "Request Form", "clipboard", [ROLES.SALES], "Main Feature"),
  {
    key: "industry",
    label: "Industry",
    icon: "business",
    roles: [ROLES.SALES],
    route: "/sales/industry",
    placementByRole: { [ROLES.SALES]: { kind: "section", title: "Manage" } },
  },
  {
    key: "account",
    label: "Account",
    icon: "account",
    roles: [ROLES.SALES],
    route: "/sales/accounts",
    placementByRole: { [ROLES.SALES]: { kind: "section", title: "Manage" } },
  },
  {
    key: "person-in-charge",
    label: "Person In Charge",
    icon: "people",
    roles: [ROLES.SALES],
    route: "/sales/person-in-charge",
    placementByRole: { [ROLES.SALES]: { kind: "section", title: "Manage" } },
  },

  // Admin QPD
  { key: "student", label: "Student", icon: "student", roles: [ROLES.ADMIN], route: "/admin/students", placementByRole: { [ROLES.ADMIN]: { kind: "section", title: "Master Data" } } },
  comingSoon("course", "Course", "course", [ROLES.ADMIN], "Master Data"),
  comingSoon("course-category", "Course Category", "category", [ROLES.ADMIN], "Master Data"),
  comingSoon("trainer", "Trainer", "people", [ROLES.ADMIN], "Master Data"),
  comingSoon("training-room", "Training Room", "room", [ROLES.ADMIN], "Master Data"),
  comingSoon("booking-room", "Booking Room", "calendar", [ROLES.ADMIN], "Master Data"),
  comingSoon("list-training", "List Training", "course", [ROLES.ADMIN], "Training"),
  comingSoon("training-calendar", "Training Calendar", "calendar", [ROLES.ADMIN], "Training"),
  comingSoon("generate-certificate", "Generate Certificate", "certificate", [ROLES.ADMIN], "Document & System"),
  comingSoon("manage-notifications", "Manage Notifications", "notification", [ROLES.ADMIN], "Document & System"),
  comingSoon("account-credentials", "Account & Credentials", "credentials", [ROLES.ADMIN], "Document & System"),
  {
    key: "audit-trail",
    label: "Audit Trail",
    icon: "audit",
    roles: [ROLES.ADMIN],
    route: "/admin/audit-trail",
    placementByRole: { [ROLES.ADMIN]: { kind: "section", title: "Document & System" } },
  },
  {
    key: "personal-account-links",
    label: "Personal Account Students",
    icon: "account",
    roles: [ROLES.ADMIN],
    route: "/admin/personal-account-links",
    placementByRole: { [ROLES.ADMIN]: { kind: "section", title: "Master Data" } },
  },

  // Finance
  feature("due-date", "Due Date", "calendar", [ROLES.FINANCE], {
    [ROLES.FINANCE]: { kind: "dashboard-item" },
  }),
  comingSoon("invoice-list", "Invoice List", "file", [ROLES.FINANCE], "Invoice"),
  comingSoon("private-invoice", "Private Invoice", "file", [ROLES.FINANCE], "Invoice"),
  comingSoon("public-invoice", "Public Invoice", "file", [ROLES.FINANCE], "Invoice"),

  // Trainer
  comingSoon("my-class-list", "My Class List", "course", [ROLES.TRAINER], "My Class"),
  comingSoon("finished-class", "Finished Class", "complete", [ROLES.TRAINER], "My Class"),
  comingSoon("monitor-class", "Monitor Class", "monitor", [ROLES.TRAINER], "My Class"),
  comingSoon("trainer-calendar", "Trainer Calendar", "calendar", [ROLES.TRAINER], "My Class"),

  // Student
  comingSoon("attendance", "Attendance", "complete", [ROLES.STUDENT], "Student Portal"),
  comingSoon("evaluation-form", "Evaluation Form", "clipboard", [ROLES.STUDENT], "Student Portal"),
  comingSoon("course-history", "Course History", "course", [ROLES.STUDENT], "Student Portal"),
  comingSoon("e-learning", "E-Learning", "monitor", [ROLES.STUDENT], "Student Portal"),
  comingSoon("remote-lab", "Remote Lab", "remote", [ROLES.STUDENT], "Student Portal"),
  comingSoon("my-profile", "My Profile", "profile", [ROLES.STUDENT], "Student Portal"),
  comingSoon("pre-post-test", "Pre / Post Test", "clipboard", [ROLES.STUDENT], "Other"),
  comingSoon("learning-path", "Learning Path", "path", [ROLES.STUDENT], "Other"),

  // PIC
  comingSoon("training-account", "Training Account", "account", [ROLES.PIC], "PIC Portal"),
  comingSoon("training-report", "Training Report", "report", [ROLES.PIC], "PIC Portal"),
  comingSoon("skill-matrix", "Skill Matrix", "matrix", [ROLES.PIC], "PIC Portal"),
];

function toNavigationItem(entry: FeatureAccessEntry, role: BusinessRole): NavigationItem {
  const implemented = Boolean(entry.route);
  return {
    key: entry.key,
    label: entry.labelByRole?.[role] ?? entry.label,
    icon: entry.icon,
    ...(entry.route ? { href: entry.route } : {}),
    ...(!implemented ? { disabled: true } : {}),
  };
}

function buildRoleNavigation(role: BusinessRole): RoleNavigation {
  const entries = FEATURE_ACCESS_MATRIX.filter((entry) => entry.roles.includes(role));
  const dashboardEntry = entries.find((entry) => entry.key === "dashboard");
  const dashboardPlacement = dashboardEntry?.placementByRole?.[role];
  const dashboard = dashboardEntry ? toNavigationItem(dashboardEntry, role) : {
    key: "dashboard",
    label: "Dashboard",
    icon: "dashboard" as const,
    disabled: true,
  };

  const sections: { title: string; items: NavigationItem[] }[] = [];
  const dashboardSectionItems: NavigationItem[] = [];
  for (const entry of entries) {
    if (entry.key === "dashboard" || !entry.placementByRole?.[role]) continue;
    const placement = entry.placementByRole[role]!;
    const item = toNavigationItem(entry, role);

    if (placement.kind === "dashboard-item") {
      dashboardSectionItems.push(item);
      continue;
    }
    if (placement.kind !== "section") continue;

    let section = sections.find((candidate) => candidate.title === placement.title);
    if (!section) {
      section = { title: placement.title, items: [] };
      sections.push(section);
    }
    section.items.push(item);
  }

  return {
    dashboard,
    ...(dashboardPlacement?.kind === "dashboard" && dashboardPlacement.sectionTitle
      ? { dashboardSectionTitle: dashboardPlacement.sectionTitle }
      : {}),
    ...(dashboardSectionItems.length > 0 ? { dashboardSectionItems } : {}),
    sections,
    routes: entries.flatMap((entry) => (entry.route ? [entry.route] : [])),
  };
}

/** Generated navigation and route registry, derived from FEATURE_ACCESS_MATRIX. */
export const navigationByRole: Record<BusinessRole, RoleNavigation> = Object.fromEntries(
  BUSINESS_ROLES.map((role) => [role, buildRoleNavigation(role)]),
) as Record<BusinessRole, RoleNavigation>;
