import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  size?: "sm" | "md";
  variant?: "default" | "primary" | "soft" | "danger" | "profile" | "ghost-red";
};

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "default",
  className = "",
  ...props
}: IconButtonProps) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
  };

  const variants = {
    default: "bg-transparent text-gray-600 hover:bg-gray-100",

    primary: "bg-[var(--color-primary)] text-white",

    soft: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",

    danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20",

    profile: "bg-radial-[at_50%_0%] from-sky-200 to-sky-500 text-white",

    "ghost-red": "bg-transparent text-rose-600 hover:bg-rose-50 hover:text-rose-700",
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        "inline-flex shrink-0 items-center justify-center",
        "rounded-[100px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DE1641] focus-visible:ring-offset-2",
        "transition-colors",
        sizes[size],
        variants[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {icon}
    </button>
  );
}
