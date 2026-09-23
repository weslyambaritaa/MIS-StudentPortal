"use client";

import Image from "next/image";

import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

import { useAuth } from "@/providers/keycloak-provider";

type NavbarProps = {
  title?: string;

  onMenuClick?: () => void;
};

export function Navbar({
  title = "Dashboard",

  onMenuClick,
}: NavbarProps) {
  const { keycloak } = useAuth();

  const handleLogout = () => {
    void keycloak.logout({
      redirectUri: `${window.location.origin}/dashboard`,
    });
  };

  return (
    <header className="sticky top-0 z-40 flex h-[var(--navbar-height)] items-center border-b border-[var(--color-border)] bg-white px-4 md:px-6">
      <div className="flex flex-1 items-center gap-4">
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
          src="/brand/mis-executrain.png"
          alt="MIS ExecuTrain"
          width={250}
          height={50}
          priority
          className="h-auto w-[220px] object-contain"
        />

        {/* Separator */}
        <div className="hidden h-7 w-px bg-[var(--color-border)] md:block" />

        {/* Page Name */}
        <span className="hidden text-sm text-[#45465F] md:block">{title}</span>
      </div>

      {/* Logout */}
      <Button
        variant="navigation"
        size="sm"
        leftIcon={<LogOut size={16} strokeWidth={1.7} />}
        onClick={handleLogout}
      >
        Logout
      </Button>
    </header>
  );
}
