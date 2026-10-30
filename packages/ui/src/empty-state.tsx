"use client";

import type { ReactNode } from "react";
import { AddButton, type ButtonSize } from "./button";
import { LordIcon, type LordIconName, type LordIconTrigger } from "./lord-icon";

export interface EmptyStateProps {
  /**
   * LordIcon name or custom path.
   * Defaults to "bookshelf" flat icon (100px).
   */
  icon?: LordIconName | (string & {});

  /** Size in pixels. Default: 100 */
  iconSize?: number | string;

  /** Animation trigger. Default: "loop" */
  iconTrigger?: LordIconTrigger;

  /** Custom colors in LordIcon format. Defaults to flat palette */
  iconColors?: string;

  /** Description saying "No ... Found" */
  description?: ReactNode;

  /** Optional action/CTA button override */
  action?: ReactNode;

  /** Callback when the Add CTA button is clicked */
  onAdd?: () => void;

  /** Label for the Add CTA button. Defaults to "Add New" */
  addLabel?: string;

  /** Size variant for AddButton. Default: "sm" */
  buttonSize?: ButtonSize;

  /** Custom container class names */
  className?: string;
}

export function EmptyState({
  icon = "bookshelf",
  iconSize = 100,
  iconTrigger = "loop",
  iconColors = "primary:#ffc738,secondary:#4bb3fd,tertiary:#de1641,quaternary:#3a3347,quinary:#2ca58d",
  description = "No Data Found",
  action,
  onAdd,
  addLabel,
  buttonSize = "sm",
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "flex h-[500px] w-full flex-col items-center justify-center gap-4 rounded-xl border border-[#E9E9E9] bg-white p-6 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex shrink-0 flex-col items-center justify-center gap-1">
        <LordIcon
          src={icon}
          size={iconSize}
          trigger={iconTrigger}
          colors={iconColors}
          className="shrink-0"
        />
        <p className="text-base font-normal text-zinc-950/60">{description}</p>
      </div>

      {action ? (
        action
      ) : onAdd ? (
        <AddButton size={buttonSize} onClick={onAdd}>{addLabel ?? "Add New"}</AddButton>
      ) : null}
    </div>
  );
}
