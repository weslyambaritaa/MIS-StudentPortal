import type { BusinessRole } from "@mis/shared-types";

import { FEATURE_ACCESS_MATRIX, type FeatureAccessEntry } from "@/config/navigation";

export function routeMatches(pathname: string, configuredRoute: string) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const normalizedRoute = configuredRoute.replace(/\/+$/, "") || "/";

  return normalizedPath === normalizedRoute || normalizedPath.startsWith(`${normalizedRoute}/`);
}

export function isRegisteredFrontendRoute(
  pathname: string,
  featureMatrix: readonly FeatureAccessEntry[] = FEATURE_ACCESS_MATRIX,
) {
  return routeMatches(pathname, "/admin/access-logs") ||
    featureMatrix.some((feature) => feature.route && routeMatches(pathname, feature.route));
}

export function canActiveRoleAccessRoute(
  pathname: string,
  activeRole: BusinessRole | null,
  featureMatrix: readonly FeatureAccessEntry[] = FEATURE_ACCESS_MATRIX,
  hasAccessLogAdminRole = false,
) {
  if (pathname === "/no-access") return activeRole === null;
  if (routeMatches(pathname, "/admin/access-logs")) return hasAccessLogAdminRole;
  if (!activeRole) return false;

  return featureMatrix.some(
    (feature) =>
      feature.route &&
      feature.roles.includes(activeRole) &&
      routeMatches(pathname, feature.route),
  );
}
