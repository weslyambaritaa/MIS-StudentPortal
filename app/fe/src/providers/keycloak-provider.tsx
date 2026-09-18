"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type KeycloakType from "keycloak-js";

import keycloak, { initializeKeycloak } from "@/lib/auth/keycloak";

import { isBusinessRole, type BusinessRole } from "@/lib/auth/roles";

type AuthContextValue = {
  keycloak: KeycloakType;
  roles: BusinessRole[];
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function KeycloakAuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);

  const [, forceRender] = useState(0);

  useEffect(() => {
    let active = true;

    initializeKeycloak()
      .then((isAuthenticated) => {
        if (!active) {
          return;
        }

        setAuthenticated(isAuthenticated);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setAuthenticated(false);
      });

    keycloak.onTokenExpired = () => {
      void keycloak
        .updateToken(30)
        .then(() => {
          forceRender((value) => value + 1);
        })
        .catch(() => {
          void keycloak.login();
        });
    };

    return () => {
      active = false;
    };
  }, []);

  const roles = useMemo<BusinessRole[]>(() => {
    const realmRoles = keycloak.realmAccess?.roles ?? [];

    return realmRoles.filter(isBusinessRole);
  }, [authenticated]);

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />

          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        keycloak,
        roles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside KeycloakAuthProvider");
  }

  return context;
}
