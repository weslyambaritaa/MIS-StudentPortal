import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LordIcon, type LordIconName } from "./lord-icon";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode | LordIconName | (string & {});
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
  disabled,
  ...props
}: IconButtonProps) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
  };

  const variants = {
    default: "group bg-transparent text-gray-600 hover:bg-neutral-100 hover:text-rose-600",

    primary: "bg-[var(--color-primary)] text-white",

    soft: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",

    danger: "group bg-[#FF4343]/20 text-[#FF4343] hover:bg-[#FF4343]/30 disabled:opacity-40 disabled:pointer-events-none",

    profile: "bg-radial-[at_50%_0%] from-sky-200 to-sky-500 text-white",

    "ghost-red": "group bg-transparent text-rose-600 hover:bg-rose-50 hover:text-rose-700",
  };

  const renderIcon = () => {
    if (typeof icon === "string") {
      const iconSize = size === "sm" ? 18 : 20;
      if (variant === "danger") {
        return (
          <LordIcon
            src={icon as LordIconName}
            size={iconSize}
            trigger="hover"
            target="button"
            colors="primary:#FF4343,secondary:#FF4343"
            className="shrink-0"
          />
        );
      }
      if (variant === "primary" || variant === "profile") {
        return (
          <LordIcon
            src={icon as LordIconName}
            size={iconSize}
            trigger="hover"
            target="button"
            colors="primary:#ffffff,secondary:#ffffff"
            className="shrink-0"
          />
        );
      }
      if (variant === "ghost-red") {
        return (
          <LordIcon
            src={icon as LordIconName}
            size={iconSize}
            trigger="hover"
            target="button"
            colors="primary:#de1641,secondary:#de1641"
            className="shrink-0"
          />
        );
      }
      return (
        <LordIcon
          src={icon as LordIconName}
          size={iconSize}
          trigger="hover"
          target="button"
          colors="primary:#6b7280,secondary:#9ca3af"
          className="shrink-0 transition-colors duration-150 group-hover:[--lord-icon-primary:#de1641] group-hover:[--lord-icon-secondary:#de1641]"
        />
      );
    }
    return icon;
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
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
      {renderIcon()}
    </button>
  );
}
