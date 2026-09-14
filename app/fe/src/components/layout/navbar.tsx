"use client";

import Link from "next/link";

import { useAuth } from "@/providers/keycloak-provider";

export function Navbar() {
  const { keycloak } = useAuth();

  const handleLogout = () => {
    void keycloak.logout({
      redirectUri: `${window.location.origin}/dashboard`,
    });
  };

  return (
    <nav className="flex items-center justify-between border-b bg-white px-6 py-4">
      <Link href="/dashboard" className="font-semibold">
        MIS Student Portal
      </Link>

      <div className="flex items-center gap-4">
        <Link href="/dashboard">Dashboard</Link>

        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
