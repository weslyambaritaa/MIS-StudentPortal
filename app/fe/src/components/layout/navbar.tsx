"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { ChevronLeft, ChevronRight, LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

import { useAuth } from "@/providers/keycloak-provider";
import { getSelectableActiveRole } from "@/lib/auth/active-role";

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
  const { keycloak, availableRoles, activeRole, setActiveRole } = useAuth();
  const router = useRouter();

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

      <div className="flex shrink-0 items-center gap-3">
        {availableRoles.length > 1 && activeRole && (
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <span className="hidden sm:inline">Role</span>
            <select
              aria-label="Active role"
              value={activeRole}
              onChange={(event) => {
                const nextRole = event.target.value;
                const selectedRole = getSelectableActiveRole(availableRoles, nextRole);
                if (!selectedRole) return;
                setActiveRole(selectedRole);
                router.replace("/dashboard");
              }}
              className="max-w-36 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role === "admin" ? "Admin QPD" : role[0].toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          </label>
        )}

        <Button
          variant="danger"
          size="default"
          leftIcon={<LogOut size={16} strokeWidth={1.7} />}
          onClick={handleLogout}
        >
          Logout
        </Button>
      </div>
    </header>
  );
}
