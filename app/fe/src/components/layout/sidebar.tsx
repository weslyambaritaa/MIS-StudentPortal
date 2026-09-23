"use client";

import { Building2, BriefcaseBusiness, FileText, Home, User, Users, X } from "lucide-react";

import { usePathname } from "next/navigation";

import { SidebarItem } from "@/components/navigation/sidebar-item";
import { SidebarSection } from "@/components/navigation/sidebar-section";
import { IconButton } from "@/components/ui/icon-button";

type SidebarProps = {
  collapsed?: boolean;

  mobileOpen?: boolean;

  onMobileClose?: () => void;
};

type SidebarContentProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Navigation */}
      <div
        className={[
          "flex flex-1 flex-col",
          collapsed ? "items-center gap-7 px-2 py-5" : "gap-7 px-5 py-5",
        ].join(" ")}
      >
        {/* MAIN FEATURE */}
        <SidebarSection title="Main Feature" collapsed={collapsed}>
          <SidebarItem
            label="Dashboard"
            href="/dashboard"
            collapsed={collapsed}
            active={pathname === "/dashboard"}
            icon={<Home size={18} strokeWidth={1.7} />}
            onClick={onNavigate}
          />

          <SidebarItem
            label="Quotation"
            href="/quotation"
            collapsed={collapsed}
            active={pathname.startsWith("/quotation")}
            icon={<FileText size={18} strokeWidth={1.7} />}
            onClick={onNavigate}
          />
        </SidebarSection>

        {/* MANAGE */}
        <SidebarSection title="Manage" collapsed={collapsed}>
          <SidebarItem
            label="Industry"
            href="/industry"
            collapsed={collapsed}
            active={pathname.startsWith("/industry")}
            icon={<BriefcaseBusiness size={18} strokeWidth={1.7} />}
            onClick={onNavigate}
          />

          <SidebarItem
            label="Account"
            href="/account"
            collapsed={collapsed}
            active={pathname.startsWith("/account")}
            icon={<Building2 size={18} strokeWidth={1.7} />}
            onClick={onNavigate}
          />

          <SidebarItem
            label="Person In Charge"
            href="/pic"
            collapsed={collapsed}
            active={pathname.startsWith("/pic")}
            icon={<Users size={18} strokeWidth={1.7} />}
            onClick={onNavigate}
          />
        </SidebarSection>
      </div>

      {/* USER PROFILE */}
      <div
        className={["mt-auto", collapsed ? "flex justify-center px-2 pb-5" : "px-5 pb-5"].join(" ")}
      >
        {collapsed ? (
          <button
            type="button"
            aria-label="User profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-white"
          >
            <User size={18} strokeWidth={1.7} />
          </button>
        ) : (
          <div className="flex w-full items-center gap-3">
            {/* Red vertical indicator */}
            <div className="h-10 w-[3px] bg-[var(--color-primary)]" />

            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-sm font-medium text-[var(--color-primary)]">
                Yudi Prasetya
              </p>

              <p className="truncate text-xs text-[#777777]">Executrain, Sales</p>
            </div>

            <button
              type="button"
              aria-label="User profile"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white"
            >
              <User size={18} strokeWidth={1.7} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ collapsed = false, mobileOpen = false, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* ===============================
          DESKTOP
      =============================== */}

      <aside
        className={[
          "hidden shrink-0 md:block",

          "rounded-[22px]",
          "bg-white",

          "transition-all duration-300",

          collapsed ? "w-[82px]" : "w-[240px]",
        ].join(" ")}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* ===============================
          MOBILE OVERLAY
      =============================== */}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* ===============================
          MOBILE SIDEBAR
      =============================== */}

      <aside
        className={[
          "fixed bottom-3 left-3 top-3 z-50",
          "w-[240px]",
          "rounded-[22px]",
          "bg-white",
          "shadow-xl",
          "transition-transform duration-300",
          "md:hidden",

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
