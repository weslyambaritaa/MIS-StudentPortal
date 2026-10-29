"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { UnderConstruction } from "@mis/ui/under-construction";
import { FEATURE_ACCESS_MATRIX } from "@/config/navigation";
import { routeMatches } from "@/lib/routing/route-access";

function getFeatureInfo(pathname: string) {
  const match = FEATURE_ACCESS_MATRIX.find(
    (item) => item.route && routeMatches(pathname, item.route)
  );

  if (match) {
    return {
      title: match.label,
    };
  }

  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? "Page";
  const formatted = lastSegment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    title: formatted,
  };
}

export default function NotFound() {
  const pathname = usePathname();
  const { title } = getFeatureInfo(pathname);

  return (
    <AppShell title={title}>
      <UnderConstruction
        title={`${title} is Under Construction`}
        description="We are currently deploying new features and optimizing our systems. Thank you for your patience while we set things up."
        icon="toolbox"
        iconColors="primary:#ebe6ef,secondary:#de1641,tertiary:#3a3347,quaternary:#b26836,quinary:#ffc738"
        backLabel="Back to Dashboard"
        backHref="/dashboard"
      />
    </AppShell>
  );
}
