"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/keycloak-provider";

export default function NoAccessPage() {
  const { keycloak } = useAuth();

  const handleLogout = () => {
    void keycloak.logout({ redirectUri: `${window.location.origin}/` });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] p-6">
      <section className="w-full max-w-lg rounded-3xl border border-rose-50 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-950">Akun belum memiliki akses MIS</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Anda berhasil masuk, tetapi akun ini belum mempunyai business role MIS. Hubungi administrator
          Keycloak untuk meminta assignment role yang sesuai.
        </p>
        <Button
          className="mt-6"
          variant="danger"
          leftIcon={<LogOut size={16} strokeWidth={1.7} />}
          onClick={handleLogout}
        >
          Logout
        </Button>
      </section>
    </main>
  );
}
