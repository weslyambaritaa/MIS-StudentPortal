"use client";

import { useState, type ReactNode } from "react";

import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  children: ReactNode;
  title?: string;
};

export function AppShell({ children, title = "Dashboard" }: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  /*
   * Untuk development sementara.
   *
   * Nanti bisa dibuat toggle berdasarkan
   * design final dari UI/UX.
   */
  const [sidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <Navbar title={title} onMenuClick={() => setMobileSidebarOpen(true)} />

      <div className="flex min-h-[calc(100vh-var(--navbar-height))] gap-4 p-3">
        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1 px-4 py-5 md:px-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
