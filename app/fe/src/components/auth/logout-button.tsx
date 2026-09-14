"use client";

import { useSession } from "next-auth/react";

export function LogoutButton() {
  const { data: session } = useSession();

  const handleLogout = () => {
    const idToken = session?.idToken;
    const issuer =
      process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;

    if (!idToken || !issuer) {
      window.location.replace("/login");
      return;
    }

    const logoutUrl = new URL(
      `${issuer}/protocol/openid-connect/logout`,
    );

    logoutUrl.searchParams.set(
      "id_token_hint",
      idToken,
    );

    logoutUrl.searchParams.set(
      "post_logout_redirect_uri",
      `${window.location.origin}/logout-complete`,
    );

    window.location.replace(logoutUrl.toString());
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
    >
      Logout
    </button>
  );
}