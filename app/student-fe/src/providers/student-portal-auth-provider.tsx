"use client";

import Keycloak, { type KeycloakInstance } from "keycloak-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createApiClient } from "@mis/api-client";
import { getAvailableRoles, getSelectableActiveRole, resolveActiveRole } from "@mis/auth";
import { ROLES } from "@mis/shared-types";
import { usePathname, useRouter } from "next/navigation";

const STUDENT_PORTAL_ROLES = [ROLES.STUDENT, ROLES.PIC] as const;
type StudentPortalRole = (typeof STUDENT_PORTAL_ROLES)[number];
const ACTIVE_ROLE_STORAGE_KEY = "student-portal-active-role";
const apiRequest = createApiClient(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://api.localhost:4000");

const keycloak = new Keycloak({
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? "http://auth.localhost:4000",
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "mis-student-portal",
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "student-portal-frontend",
});

let initPromise: Promise<boolean> | null = null;
function initializeKeycloak() {
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: "login-required",
      checkLoginIframe: false,
      pkceMethod: "S256",
      redirectUri: `${window.location.origin}/dashboard`,
    });
  }
  return initPromise;
}

type StudentPortalAuthContextValue = {
  keycloak: KeycloakInstance;
  availableRoles: StudentPortalRole[];
  activeRole: StudentPortalRole | null;
  setActiveRole: (role: StudentPortalRole) => void;
};

const StudentPortalAuthContext = createContext<StudentPortalAuthContextValue | null>(null);

export function StudentPortalAuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<StudentPortalRole[]>([]);
  const [activeRole, setActiveRoleState] = useState<StudentPortalRole | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const syncedStudentSubject = useRef<string | null>(null);

  const updateRoles = useCallback(() => {
    const roles = getAvailableRoles(STUDENT_PORTAL_ROLES, keycloak.realmAccess?.roles ?? []);
    const selected = resolveActiveRole(roles, window.localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY));
    setAvailableRoles(roles);
    setActiveRoleState(selected);
    if (selected) window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, selected);
    setReady(true);
  }, []);

  useEffect(() => {
    let active = true;
    initializeKeycloak().then((isAuthenticated) => {
      if (!active) return;
      setAuthenticated(isAuthenticated);
      if (isAuthenticated) updateRoles();
      else { setError(true); setReady(true); }
    }).catch((authError: unknown) => {
      console.error("Student Portal Keycloak initialization failed", authError);
      if (active) { setError(true); setReady(true); }
    });
    keycloak.onAuthSuccess = updateRoles;
    keycloak.onAuthRefreshSuccess = updateRoles;
    keycloak.onTokenExpired = () => {
      void keycloak.updateToken(30).catch(() => { void keycloak.login(); });
    };
    return () => {
      active = false;
      keycloak.onAuthSuccess = undefined;
      keycloak.onAuthRefreshSuccess = undefined;
      keycloak.onTokenExpired = undefined;
    };
  }, [updateRoles]);

  useEffect(() => {
    if (!authenticated || !ready) return;
    if (availableRoles.length === 0 && pathname !== "/no-access") router.replace("/no-access");
    else if (availableRoles.length > 0 && pathname === "/no-access") router.replace("/dashboard");
  }, [authenticated, availableRoles, pathname, ready, router]);

  useEffect(() => {
    if (!authenticated || !ready || !availableRoles.includes(ROLES.STUDENT) || !keycloak.token) return;
    const subject = keycloak.tokenParsed?.sub;
    if (!subject || syncedStudentSubject.current === subject) return;
    let cancelled = false;
    const recordLogin = async () => {
      try {
        await keycloak.updateToken(30);
        if (!cancelled && keycloak.token) {
          await apiRequest("/api/v1/external/me", keycloak.token, ROLES.STUDENT);
          syncedStudentSubject.current = subject;
        }
      } catch (firstError) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        if (cancelled || !keycloak.token) return;
        try {
          await apiRequest("/api/v1/external/me", keycloak.token, ROLES.STUDENT);
          syncedStudentSubject.current = subject;
        } catch (retryError) {
          console.error("Could not record Student portal login", retryError ?? firstError);
        }
      }
    };
    void recordLogin();
    return () => { cancelled = true; };
  }, [authenticated, availableRoles, ready]);

  const setActiveRole = useCallback((requestedRole: StudentPortalRole) => {
    const selected = getSelectableActiveRole(availableRoles, requestedRole);
    if (!selected) throw new Error("Select a Student Portal role assigned to this account.");
    setActiveRoleState(selected);
    window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, selected);
  }, [availableRoles]);

  const value = useMemo(() => ({ keycloak, availableRoles, activeRole, setActiveRole }), [availableRoles, activeRole, setActiveRole]);

  if (error) return <main className="flex min-h-screen items-center justify-center p-6"><p role="alert">We could not sign you in. Refresh the page and try again.</p></main>;
  if (!authenticated || !ready) return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading Student Portal…</main>;

  return <StudentPortalAuthContext.Provider value={value}>{children}</StudentPortalAuthContext.Provider>;
}

export function useStudentPortalAuth() {
  const value = useContext(StudentPortalAuthContext);
  if (!value) throw new Error("useStudentPortalAuth must be used inside StudentPortalAuthProvider");
  return value;
}

