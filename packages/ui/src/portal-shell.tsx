"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LogOut, Menu, User, X } from "lucide-react";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { LogoutConfirmationModal } from "./logout-confirmation-modal";

export type PortalNavigationItem = {
  key: string;
  label: string;
  icon: ReactNode | ((context: { active: boolean; collapsed: boolean }) => ReactNode);
  href?: string;
  disabled?: boolean;
};

export type PortalNavigationSection = {
  title?: string;
  items: readonly PortalNavigationItem[];
};

export type PortalNavigation = {
  dashboard?: PortalNavigationItem;
  dashboardSectionTitle?: string;
  dashboardSectionItems?: readonly PortalNavigationItem[];
  sections: readonly PortalNavigationSection[];
};

type PortalShellProps = {
  children: ReactNode;
  title?: string;
  brandSrc?: string;
  navigation: PortalNavigation;
  userName: string;
  activeRole: string | null;
  availableRoles: readonly string[];
  onRoleChange: (role: string) => void;
  onLogout: () => void;
  roleLabel?: (role: string) => string;
  headerActions?: ReactNode;
};

function NavigationLink({ item, active, collapsed, onNavigate }: {
  item: PortalNavigationItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const className = [
    "group flex items-center gap-3 rounded-[100px] px-3 py-2.5 text-base font-medium transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2",
    collapsed ? "size-10 justify-center px-0" : "w-full justify-start",
    active
      ? "bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white hover:to-[#F90237]"
      : "text-gray-600 hover:bg-rose-100 hover:text-rose-700",
  ].join(" ");
  const iconNode = typeof item.icon === "function" ? item.icon({ active, collapsed }) : item.icon;
  const content = <>
    <span className={`flex size-5 shrink-0 items-center justify-center leading-none transition-colors duration-150 ${active ? "group-hover:[--lord-icon-primary:#ffffff]" : "group-hover:[--lord-icon-primary:#de1641] group-hover:[--lord-icon-secondary:#de1641]"}`}>{iconNode}</span>
    {!collapsed && <span className="truncate font-sans leading-none">{item.label}</span>}
  </>;

  if (!item.href || item.disabled) {
    return <button type="button" disabled title={collapsed ? `${item.label} - Coming soon` : undefined} aria-label={item.disabled ? `${item.label}, coming soon` : item.label} className={`${className} cursor-not-allowed`}>{content}</button>;
  }

  return <Link href={item.href} title={collapsed ? item.label : undefined} onClick={onNavigate} className={className}>{content}</Link>;
}

function PortalSidebar({ navigation, activePath, userName, activeRole, collapsed, onNavigate }: {
  navigation: PortalNavigation;
  activePath: string;
  userName: string;
  activeRole: string | null;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const renderSection = (title: string | undefined, items: readonly PortalNavigationItem[]) => (
    <section key={title ?? "dashboard"} className={collapsed ? "w-10" : "w-full"}>
      {title && <p className={collapsed ? "mb-3 text-center text-xs font-medium text-slate-900/40" : "mb-2 text-xs font-medium uppercase text-slate-900/40"}>{collapsed ? "---" : title}</p>}
      <div className={collapsed ? "flex flex-col items-center gap-2" : "flex flex-col gap-2"}>
        {items.map((item) => <NavigationLink key={item.key} item={item} active={Boolean(item.href && (item.href === "/dashboard" ? activePath === item.href : activePath.startsWith(item.href)))} collapsed={collapsed} onNavigate={onNavigate} />)}
      </div>
    </section>
  );

  const dashboardInSection = navigation.dashboardSectionTitle !== undefined;
  const topItems = [
    ...(!dashboardInSection && navigation.dashboard ? [navigation.dashboard] : []),
    ...(dashboardInSection && navigation.dashboard ? [navigation.dashboard, ...(navigation.dashboardSectionItems ?? [])] : []),
  ];

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden p-5">
      <div
        className={`flex-1 overflow-y-auto overscroll-contain pr-1 -mr-1 [scrollbar-width:thin] [scrollbar-color:#e5e7eb_transparent] ${
          collapsed ? "flex flex-col items-center gap-6" : "flex flex-col gap-6"
        }`}
      >
        {topItems.length > 0 && renderSection(dashboardInSection ? navigation.dashboardSectionTitle : undefined, topItems)}
        {navigation.sections.map((section, index) => renderSection(section.title ?? `section-${index}`, section.items))}
      </div>
      <div className={`shrink-0 pt-4 border-t border-rose-50/80 ${collapsed ? "flex justify-center" : "flex items-center justify-end gap-3"}`}>
        {!collapsed && <div className="h-10 w-[3px] rounded-[1px] bg-sky-500" />}
        {!collapsed && (
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-base font-medium text-sky-500">{userName}</p>
            <p className="truncate text-sm text-zinc-950/60">{activeRole ?? "-"}</p>
          </div>
        )}
        <IconButton label="User profile" variant="profile" icon={<User size={20} />} />
      </div>
    </div>
  );
}

export function PortalShell({
  children,
  title = "Dashboard",
  brandSrc = "/brand/ExecuTrain_logo.png",
  navigation,
  userName,
  activeRole,
  availableRoles,
  onRoleChange,
  onLogout,
  roleLabel = (role) => role[0]?.toUpperCase() + role.slice(1),
  headerActions,
}: PortalShellProps) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return <div className="min-h-screen bg-[#f7f7f8] font-sans">
    <header className="sticky top-0 z-40 flex min-h-[68px] items-center justify-between border-b border-rose-50 bg-white px-4 py-3 md:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="md:hidden"><IconButton label="Open menu" icon={<Menu size={20} strokeWidth={1.7} />} onClick={() => setMobileSidebarOpen(true)} /></div>
        <Image src={brandSrc} alt="ExecuTrain" width={553} height={140} priority className="h-10 w-40 shrink-0 object-contain" />
        <div className="hidden h-6 w-px bg-zinc-950/20 md:block" />
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <IconButton label={sidebarCollapsed ? "Open sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Open sidebar" : "Collapse sidebar"} variant="ghost-red" icon={sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} />
          <span className="truncate text-sm font-normal text-zinc-950/60">&ldquo;{title}&rdquo;</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {headerActions}
        {availableRoles.length > 0 && activeRole && <label className="flex items-center gap-2 text-sm text-zinc-700"><span className="hidden sm:inline">Role</span><select aria-label="Active role" className="max-w-36 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-rose-400" value={activeRole} onChange={(event) => onRoleChange(event.target.value)}>{availableRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>}
        <Button variant="danger" size="default" leftIcon={<LogOut size={16} strokeWidth={1.7} />} onClick={() => setLogoutOpen(true)}>Logout</Button>
      </div>
    </header>

    <div className="flex min-h-[calc(100vh-var(--navbar-height))] gap-4 p-3">
      <aside
        className={[
          "sticky top-[calc(var(--navbar-height,68px)+0.75rem)] h-[calc(100vh-var(--navbar-height,68px)-1.5rem)] self-start hidden shrink-0 rounded-3xl border border-rose-50 bg-white transition-[width] duration-200 md:block",
          sidebarCollapsed ? "w-20" : "w-[240px]",
        ].join(" ")}
      >
        <PortalSidebar
          navigation={navigation}
          activePath={pathname}
          userName={userName}
          activeRole={activeRole}
          collapsed={sidebarCollapsed}
        />
      </aside>
      {mobileSidebarOpen && <button type="button" aria-label="Close sidebar" className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={closeMobileSidebar} />}
      <aside className={["fixed bottom-3 left-3 top-3 z-50 w-[240px] rounded-3xl border border-rose-50 bg-white shadow-xl transition-transform duration-300 md:hidden", mobileSidebarOpen ? "translate-x-0" : "-translate-x-[120%]"].join(" ")}>
        <div className="absolute right-3 top-3 z-10"><IconButton label="Close menu" icon={<X size={19} />} onClick={closeMobileSidebar} /></div>
        <PortalSidebar navigation={navigation} activePath={pathname} userName={userName} activeRole={activeRole} collapsed={false} onNavigate={closeMobileSidebar} />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 md:px-5 lg:px-6">{children}</main>
    </div>
    <LogoutConfirmationModal open={logoutOpen} onClose={() => setLogoutOpen(false)} onConfirm={onLogout} />
  </div>;
}
