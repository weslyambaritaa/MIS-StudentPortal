"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "./button";
import { LordIcon, type LordIconName } from "./lord-icon";

export interface UnderConstructionProps {
  /** Title of the empty/construction state. Default: "Page is Under Construction" */
  title?: ReactNode;

  /** Description message. */
  description?: ReactNode;

  /**
   * LordIcon name (from registry e.g. "toolbox", "hourglass", "briefcase", etc.) or JSON file path.
   * Default: "toolbox"
   */
  icon?: LordIconName | (string & {});

  /** Size in pixels for the LordIcon. Default: 120 */
  iconSize?: number | string;

  /** LordIcon animation trigger. Default: "loop" */
  iconTrigger?: "loop" | "hover" | "click" | "in" | "morph" | "boomerang" | "loop-on-hover";

  /** Custom color mapping for the LordIcon. Default includes flat multi-colors: primary, secondary, tertiary, quaternary, quinary */
  iconColors?: string;

  /** Label for the action button. Default: "Back to Dashboard" */
  backLabel?: string;

  /** Destination URL for the action button. Default: "/dashboard" */
  backHref?: string;

  /** Optional click handler for the action button (overrides link navigation) */
  onBack?: () => void;

  /** Whether to show the action button. Default: true */
  showBackButton?: boolean;

  /** Custom class name for the outer container */
  className?: string;
}

export function UnderConstruction({
  title = "Page is Under Construction",
  description = (
    <>
      We are currently deploying new features and optimizing our systems.
      <br className="hidden sm:inline" />
      {" "}Thank you for your patience while we set things up.
    </>
  ),
  icon = "toolbox",
  iconSize = 120,
  iconTrigger = "loop",
  iconColors = "primary:#ebe6ef,secondary:#de1641,tertiary:#3a3347,quaternary:#b26836,quinary:#ffc738",
  backLabel = "Back to Dashboard",
  backHref = "/dashboard",
  onBack,
  showBackButton = true,
  className = "",
}: UnderConstructionProps) {
  return (
    <div
      className={[
        "flex-1 self-stretch w-full min-h-[calc(100vh-var(--navbar-height,68px)-3.5rem)] p-6 sm:p-10 md:p-14 bg-gradient-to-b from-white to-rose-100 rounded-3xl border border-rose-50 flex flex-col justify-center items-center gap-5 sm:gap-6 text-center transition-all",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="p-4 bg-white rounded-2xl border border-rose-50 inline-flex justify-center items-center gap-2.5 shrink-0">
        <LordIcon
          src={icon}
          size={iconSize}
          trigger={iconTrigger}
          delay={1200}
          colors={iconColors}
        />
      </div>

      <div className="w-full max-w-[671px] flex flex-col justify-start items-center gap-1.5 text-center">
        <div className="self-stretch text-center text-gray-600 text-2xl sm:text-3xl font-medium font-sans">
          {title}
        </div>
        <div className="self-stretch text-center text-zinc-950/60 text-sm font-normal font-sans leading-relaxed">
          {description}
        </div>
      </div>

      {showBackButton && (
        onBack ? (
          <Button variant="primary" size="default" className="w-52" onClick={onBack}>
            {backLabel}
          </Button>
        ) : (
          <Link href={backHref} className="inline-block">
            <Button variant="primary" size="default" className="w-52">
              {backLabel}
            </Button>
          </Link>
        )
      )}
    </div>
  );
}
