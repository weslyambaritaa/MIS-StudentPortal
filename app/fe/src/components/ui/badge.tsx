import type { ReactNode } from "react";

type BadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "neutral";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  showDot?: boolean;
};

const variants: Record<BadgeVariant, string> = {
  success:
    "bg-green-500/20 text-green-500 outline outline-1 outline-offset-[-1px] outline-green-500",

  danger:
    "bg-red-500/10 text-red-500 outline outline-1 outline-offset-[-1px] outline-red-500",

  warning:
    "bg-yellow-500/20 text-yellow-500 outline outline-1 outline-offset-[-1px] outline-yellow-500",

  neutral:
    "bg-gray-100 text-gray-600 outline outline-1 outline-offset-[-1px] outline-gray-300",
};

export function Badge({
  children,
  variant = "neutral",
  showDot = false,
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center",
        "gap-2 rounded-[100px]",
        "px-3 py-1",
        "text-xs font-medium",
        variants[variant],
      ].join(" ")}
    >
      {showDot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
