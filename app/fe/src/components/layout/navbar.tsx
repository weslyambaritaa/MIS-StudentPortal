"use client";

import Image from "next/image";

import { ChevronLeft, ChevronRight, LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

import { useAuth } from "@/providers/keycloak-provider";

type NavbarProps = {
  title?: string;

  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
};

export function Navbar({
  title = "Dashboard",

  onMenuClick,
  sidebarCollapsed = false,
  onSidebarToggle,
}: NavbarProps) {
  const { keycloak } = useAuth();

  const handleLogout = () => {
    void keycloak.logout({
      redirectUri: `${window.location.origin}/dashboard`,
    });
  };

  return (
    <header className="sticky top-0 z-40 flex min-h-[68px] items-center justify-between border-b border-rose-50 bg-white px-4 py-3 md:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {/* Mobile Hamburger */}
        <div className="md:hidden">
          <IconButton
            label="Open menu"
            icon={<Menu size={20} strokeWidth={1.7} />}
            onClick={onMenuClick}
          />
        </div>

        {/* Logo */}
        <Image
          src="/brand/ExecuTrain_logo.png"
          alt="ExecuTrain"
          width={553}
          height={140}
          priority
          className="h-10 w-40 shrink-0 object-contain"
        />

        {/* Separator */}
        <div className="hidden h-6 w-px bg-zinc-950/20 md:block" />

        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <IconButton
            label={sidebarCollapsed ? "Open sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Open sidebar" : "Collapse sidebar"}
            variant="ghost-red"
            icon={sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            onClick={onSidebarToggle}
          />
          <span className="truncate text-sm font-normal text-zinc-950/60">&ldquo;{title}&rdquo;</span>
        </div>
      </div>

      {/* Logout */}
      <Button
        variant="danger"
        size="default"
        leftIcon={<LogOut size={16} strokeWidth={1.7} />}
        onClick={handleLogout}
      >
        Logout
      </Button>
    </header>
  );
}
