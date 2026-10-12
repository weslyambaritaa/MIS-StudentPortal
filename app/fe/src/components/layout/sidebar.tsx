"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  ChartNetwork,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FlaskConical,
  GraduationCap,
  History,
  Home,
  KeyRound,
  Layers,
  Monitor,
  Network,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import {
  navigationByRole,
  type NavigationIcon,
  type NavigationItem,
} from "@/config/navigation";
import { useAuth } from "@/providers/keycloak-provider";

type SidebarProps = {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

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

function getIcon(icon: NavigationIcon): ReactNode {
  const Icon = navigationIcons[icon];
  return <Icon size={20} strokeWidth={1.7} />;
}

type RenderedNavigationItem = Omit<NavigationItem, "icon"> & { icon: ReactNode };

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: RenderedNavigationItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const className = [
    "flex items-center gap-3 rounded-[100px] px-3 py-2.5 text-base font-medium transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2",
    collapsed ? "size-10 justify-center px-0" : "w-full justify-start",
    active
      ? "bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white hover:to-[#F90237]"
      : "text-gray-600 hover:bg-rose-100 hover:text-rose-700",
  ].join(" ");

  const content = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center">{item.icon}</span>
      {!collapsed && <span className="truncate font-['DM_Sans']">{item.label}</span>}
    </>
  );

  if (!item.href || item.disabled) {
    return (
      <button
        type="button"
        disabled
        title={collapsed ? `${item.label} - Segera tersedia` : "Halaman belum tersedia"}
        aria-label={`${item.label}, belum tersedia`}
        className={`${className} cursor-not-allowed`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={className}
    >
      {content}
    </Link>
  );
}

function SidebarContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { keycloak, activeRole, hasAccessLogAdminRole } = useAuth();
  const navigation = activeRole ? navigationByRole[activeRole] : null;
  const displayName =
    (typeof keycloak.tokenParsed?.name === "string" && keycloak.tokenParsed.name) ||
    (typeof keycloak.tokenParsed?.preferred_username === "string" &&
      keycloak.tokenParsed.preferred_username) ||
    (typeof keycloak.tokenParsed?.email === "string" && keycloak.tokenParsed.email) ||
    "-";
  const roleNames = activeRole ?? "-";

  return (
    <div className="flex h-full flex-col justify-between p-5">
      <div className={collapsed ? "flex flex-col items-center gap-6" : "flex flex-col gap-6"}>
        {navigation && !navigation.dashboardSectionTitle && (
          <NavLink
            item={{ ...navigation.dashboard, icon: getIcon(navigation.dashboard.icon) }}
            active={pathname === navigation.dashboard.href}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        )}

        {navigation?.dashboardSectionTitle && (
          <section className={collapsed ? "w-10" : "w-full"}>
            <p
              className={
                collapsed
                  ? "mb-3 text-center text-xs font-medium text-slate-900/40"
                  : "mb-2 text-xs font-medium uppercase text-slate-900/40"
              }
            >
              {collapsed ? "---" : navigation.dashboardSectionTitle}
            </p>
            <div className={collapsed ? "flex flex-col items-center gap-2" : "flex flex-col gap-2"}>
              <NavLink
                item={{ ...navigation.dashboard, icon: getIcon(navigation.dashboard.icon) }}
                active={pathname === navigation.dashboard.href}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
              {(navigation.dashboardSectionItems ?? []).map((item) => (
                <NavLink
                  key={item.key}
                  item={{ ...item, icon: getIcon(item.icon) }}
                  active={Boolean(item.href && pathname.startsWith(item.href))}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        )}

        {(navigation?.sections ?? []).map((section) => (
          <section key={section.title} className={collapsed ? "w-10" : "w-full"}>
            {section.title && (
              <p
                className={
                  collapsed
                    ? "mb-3 text-center text-xs font-medium text-slate-900/40"
                    : "mb-2 text-xs font-medium uppercase text-slate-900/40"
                }
              >
                {collapsed ? "---" : section.title}
              </p>
            )}
            <div className={collapsed ? "flex flex-col items-center gap-2" : "flex flex-col gap-2"}>
              {section.items.map((item) => (
                <NavLink
                  key={item.key}
                  item={{ ...item, icon: getIcon(item.icon) }}
                  active={Boolean(item.href && pathname.startsWith(item.href))}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        ))}

        {hasAccessLogAdminRole && (
          <section className={collapsed ? "w-10" : "w-full"}>
            {!collapsed && <p className="mb-2 text-xs font-medium uppercase text-slate-900/40">Administration</p>}
            <NavLink
              item={{ key: "access-logs", label: "Access Logs", icon: getIcon("audit"), href: "/admin/access-logs" }}
              active={pathname.startsWith("/admin/access-logs")}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          </section>
        )}
      </div>

      <div className={collapsed ? "flex justify-center" : "flex items-center justify-end gap-3"}>
        {!collapsed && <div className="h-10 w-[3px] rounded-[1px] bg-sky-500" />}
        {!collapsed && (
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-base font-medium text-sky-500">{displayName}</p>
            <p className="truncate text-sm text-zinc-950/60">{roleNames}</p>
          </div>
        )}
        <IconButton label="User profile" variant="profile" icon={<User size={20} />} />
      </div>
    </div>
  );
}

export function Sidebar({ collapsed = false, mobileOpen = false, onMobileClose }: SidebarProps) {
  return (
    <>
      <aside
        className={[
          "hidden shrink-0 rounded-3xl border border-rose-50 bg-white transition-[width] duration-200 md:block",
          collapsed ? "w-20" : "w-[240px]",
        ].join(" ")}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={[
          "fixed bottom-3 left-3 top-3 z-50 w-[240px] rounded-3xl border border-rose-50 bg-white shadow-xl transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-[120%]",
        ].join(" ")}
      >
        <div className="absolute right-3 top-3 z-10">
          <IconButton label="Close menu" icon={<X size={19} />} onClick={onMobileClose} />
        </div>
        <SidebarContent onNavigate={onMobileClose} />
      </aside>
    </>
  );
}
