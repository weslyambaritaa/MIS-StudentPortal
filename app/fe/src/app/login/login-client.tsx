"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

export default function LoginClient() {
  useEffect(() => {
    void signIn("keycloak", {
      callbackUrl: "/dashboard",
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p>Redirecting to login...</p>
    </main>
  );
}
