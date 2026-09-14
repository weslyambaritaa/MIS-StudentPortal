"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function LogoutCompletePage() {
  useEffect(() => {
    const completeLogout = async () => {
      await signOut({
        redirect: false,
      });

      window.location.replace("/login");
    };

    void completeLogout();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p>Signing out...</p>
    </main>
  );
}