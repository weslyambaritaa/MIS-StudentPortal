"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Building2, ClipboardList, FileText, Home, Network, User, Users, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { useAuth } from "@/providers/keycloak-provider";

type SidebarProps = {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: "Main Feature",
    items: [
      { label: "Quotation", href: "/quotation", icon: <FileText size={20} /> },
      { label: "Request Form", href: "/request-form", icon: <ClipboardList size={20} /> },
    ],
  },
  {
    title: "Manage",
    items: [
      { label: "Industry", href: "/industry", icon: <Building2 size={20} /> },
      { label: "Account", href: "/account", icon: <Network size={20} /> },
      { label: "Person In Charge", href: "/pic", icon: <Users size={20} /> },
    ],
  },
];

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={[
        "flex items-center gap-3 rounded-[100px] px-3 py-2.5 text-base font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2",
        collapsed ? "size-10 justify-center px-0" : "w-full justify-start",
        active
          ? "bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white hover:to-[#F90237]"
          : "text-gray-600 hover:bg-rose-100 hover:text-rose-700",
      ].join(" ")}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">{item.icon}</span>
      {!collapsed && <span className="truncate font-['DM_Sans']">{item.label}</span>}
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
  const { keycloak, roles } = useAuth();
  const sections = groups;
  const username =
    typeof keycloak.tokenParsed?.preferred_username === "string"
      ? keycloak.tokenParsed.preferred_username
      : "-";
  const roleNames = roles.length > 0 ? roles.join(", ") : "-";

  return (
    <div className="flex h-full flex-col justify-between p-5">
      <div className={collapsed ? "flex flex-col items-center gap-6" : "flex flex-col gap-6"}>
        <NavLink
          item={{ label: "Dashboard", href: "/dashboard", icon: <Home size={20} /> }}
          active={pathname === "/dashboard"}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />

        {sections.map((section) => (
          <section key={section.title} className={collapsed ? "w-10" : "w-full"}>
            <p
              className={
                collapsed
                  ? "mb-3 text-center text-xs font-medium text-slate-900/40"
                  : "mb-2 text-xs font-medium uppercase text-slate-900/40"
              }
            >
              {collapsed ? "---" : section.title}
            </p>
            <div className={collapsed ? "flex flex-col items-center gap-2" : "flex flex-col gap-2"}>
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={pathname.startsWith(item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className={collapsed ? "flex justify-center" : "flex items-center justify-end gap-3"}>
        {!collapsed && <div className="h-10 w-[3px] rounded-[1px] bg-sky-500" />}
        {!collapsed && (
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-base font-medium text-sky-500">{username}</p>
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
