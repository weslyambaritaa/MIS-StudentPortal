"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import type KeycloakType from "keycloak-js";
import type { BusinessRole } from "@mis/shared-types";

import keycloak, { initializeKeycloak } from "@/lib/auth/keycloak";
import {
  ACTIVE_ROLE_STORAGE_KEY,
  getAvailableBusinessRoles,
  getSelectableActiveRole,
  resolveActiveRole,
} from "@/lib/auth/active-role";

type AuthContextValue = {
  keycloak: KeycloakType;
  availableRoles: BusinessRole[];
  activeRole: BusinessRole | null;
  setActiveRole: (role: BusinessRole) => void;
  /** Temporary compatibility alias for existing pages during the UI migration. */
  roles: BusinessRole[];
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function KeycloakAuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [rolesReady, setRolesReady] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<BusinessRole[]>([]);
  const [activeRole, setActiveRoleState] = useState<BusinessRole | null>(null);
  const activeRoleRef = useRef<BusinessRole | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const refreshAvailableRoles = useCallback(() => {
    const nextRoles = getAvailableBusinessRoles(keycloak.realmAccess?.roles ?? []);
    const currentRole = activeRoleRef.current;
    const storedRole = window.localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
    const nextActiveRole =
      nextRoles.length === 1
        ? nextRoles[0]
        : currentRole && nextRoles.includes(currentRole)
          ? currentRole
          : resolveActiveRole(nextRoles, storedRole);

    setAvailableRoles(nextRoles);
    activeRoleRef.current = nextActiveRole;
    setActiveRoleState(nextActiveRole);

    if (nextActiveRole) {
      window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, nextActiveRole);
    } else {
      window.localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    }

    if (currentRole && nextActiveRole && currentRole !== nextActiveRole) {
      router.replace("/dashboard");
    }

    setRolesReady(true);
  }, [router]);

  useEffect(() => {
    let active = true;
    const initTimeout = window.setTimeout(() => {
      if (!active) return;

      const message = "Keycloak initialization did not finish within 20 seconds.";
      console.error(`[auth] ${message}`);
      setAuthError(message);
    }, 20_000);

    keycloak.onAuthSuccess = refreshAvailableRoles;
    keycloak.onAuthRefreshSuccess = refreshAvailableRoles;

    initializeKeycloak()
      .then((isAuthenticated) => {
        window.clearTimeout(initTimeout);
        if (!active) {
          return;
        }

        if (!isAuthenticated) {
          const message = "Keycloak initialization completed without an authenticated session.";
          console.error(`[auth] ${message}`);
          setAuthError(message);
          setAuthenticated(false);
          return;
        }

        setAuthError(null);
        refreshAvailableRoles();
        setAuthenticated(isAuthenticated);
      })
      .catch((error: unknown) => {
        window.clearTimeout(initTimeout);
        if (!active) {
          return;
        }

        console.error("[auth] Keycloak initialization failed", error);
        const message =
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
        setAuthError(message);
        setAuthenticated(false);
      });

    keycloak.onTokenExpired = () => {
      void keycloak
        .updateToken(30)
        .catch(() => {
          void keycloak.login();
        });
    };

    return () => {
      active = false;
      window.clearTimeout(initTimeout);
      keycloak.onAuthSuccess = undefined;
      keycloak.onAuthRefreshSuccess = undefined;
      keycloak.onTokenExpired = undefined;
    };
  }, [refreshAvailableRoles]);

  const setActiveRole = useCallback((role: BusinessRole) => {
    const selectedRole = getSelectableActiveRole(availableRoles, role);
    if (!selectedRole) {
      throw new Error("Active role must be a business role assigned to this user");
    }

    activeRoleRef.current = selectedRole;
    setActiveRoleState(selectedRole);
    window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, selectedRole);
  }, [availableRoles]);

  useEffect(() => {
    if (!authenticated || !rolesReady) return;

    if (availableRoles.length === 0 && pathname !== "/no-access") {
      router.replace("/no-access");
    } else if (availableRoles.length > 0 && pathname === "/no-access") {
      router.replace("/dashboard");
    }
  }, [authenticated, availableRoles, pathname, rolesReady, router]);

  if (authError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <section role="alert" className="w-full max-w-xl rounded-lg bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Login belum selesai</h1>
          <p className="mt-3 text-sm text-gray-600">
            Aplikasi tidak dapat menyelesaikan inisialisasi autentikasi. Silakan coba lagi.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-4 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-3 text-xs text-gray-800">
              {authError}
            </pre>
          )}
          <button
            type="button"
            className="mt-6 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            onClick={() => window.location.reload()}
          >
            Coba lagi
          </button>
        </section>
      </main>
    );
  }

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

  if (!rolesReady || (availableRoles.length === 0 && pathname !== "/no-access")) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-600">Loading access context...</p>
      </main>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        keycloak,
        availableRoles,
        activeRole,
        setActiveRole,
        roles: availableRoles,
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
