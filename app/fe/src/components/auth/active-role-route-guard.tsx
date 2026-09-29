"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { knownFrontendRoutes, navigationByRole } from "@/config/navigation";
import { useAuth } from "@/providers/keycloak-provider";

function routeMatches(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function ActiveRoleRouteGuard({ children }: { children: ReactNode }) {
  const { activeRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isKnownRoute = knownFrontendRoutes.some((route) => routeMatches(pathname, route));
  const roleCanAccessRoute = activeRole
    ? navigationByRole[activeRole].routes.some((route) => routeMatches(pathname, route))
    : pathname === "/no-access";

  useEffect(() => {
    if (isKnownRoute && !roleCanAccessRoute) {
      router.replace(activeRole ? "/dashboard" : "/no-access");
    }
  }, [activeRole, isKnownRoute, roleCanAccessRoute, router]);

  if (isKnownRoute && !roleCanAccessRoute) return null;
  return children;
}
