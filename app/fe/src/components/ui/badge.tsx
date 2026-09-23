import type { ReactNode } from "react";

type BadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "neutral";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
};

const variants: Record<BadgeVariant, string> = {
  success:
    "bg-green-100 text-green-700",

  danger:
    "bg-red-100 text-red-700",

  warning:
    "bg-yellow-100 text-yellow-700",

  neutral:
    "bg-gray-100 text-gray-700",
};

export function Badge({
  children,
  variant = "neutral",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center",
        "rounded-full",
        "px-3 py-1",
        "text-xs font-medium",
        variants[variant],
      ].join(" ")}
    >
      {children}
    </span>
  );
}