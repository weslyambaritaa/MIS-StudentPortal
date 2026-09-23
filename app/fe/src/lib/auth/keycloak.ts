"use client";

import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? "http://auth.localhost:4000",

  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "mis-student-portal",

  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "mis-student-portal-frontend",
});

/*
 * React development mode dapat menjalankan effect
 * lebih dari sekali.
 *
 * Karena Keycloak tidak boleh di-init dua kali
 * pada instance yang sama, kita simpan Promise-nya.
 */
let initPromise: Promise<boolean> | null = null;

export function initializeKeycloak() {
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: "login-required",
      checkLoginIframe: false,
      pkceMethod: "S256",

      redirectUri: `${window.location.origin}${window.location.pathname}`,
    });
  }

  return initPromise;
}

export default keycloak;
