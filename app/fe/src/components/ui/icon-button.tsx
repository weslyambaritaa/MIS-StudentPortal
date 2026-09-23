import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  size?: "sm" | "md";
  variant?: "default" | "primary" | "soft";
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
    default: "bg-transparent text-[var(--color-text-primary)] hover:bg-gray-100",

    primary: "bg-[var(--color-primary)] text-white",

    soft: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        "inline-flex shrink-0 items-center justify-center",
        "rounded-full",
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
