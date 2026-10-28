"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@mis/ui/button";
import { LogoutConfirmationModal } from "@mis/ui/logout-confirmation-modal";
import { useAuth } from "@/providers/keycloak-provider";

export default function NoAccessPage() {
  const { keycloak, hasAccessLogAdminRole } = useAuth();
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);

  const handleLogout = () => {
    void keycloak.logout({ redirectUri: `${window.location.origin}/` });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] p-6">
      <section className="w-full max-w-lg rounded-3xl border border-rose-50 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-950">Account does not have MIS access</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          You have successfully signed in, but this account does not have an MIS business role yet.
          Please contact your Keycloak administrator to request the appropriate role assignment.
        </p>
        {hasAccessLogAdminRole && (
          <Link
            className="mt-5 inline-flex rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
            href="/admin/access-logs"
          >
            Open Access Logs
          </Link>
        )}
        <Button
          className="mt-6"
          variant="danger"
          leftIcon={<LogOut size={16} strokeWidth={1.7} />}
          onClick={() => setLogoutConfirmationOpen(true)}
        >
          Logout
        </Button>
      </section>

      <LogoutConfirmationModal
        open={logoutConfirmationOpen}
        onClose={() => setLogoutConfirmationOpen(false)}
        onConfirm={handleLogout}
      />
    </main>
  );
}
