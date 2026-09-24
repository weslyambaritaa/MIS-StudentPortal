import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "soft" | "ghost" | "danger" | "navigation";

type ButtonSize = "default" | "sm" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;

  variant?: ButtonVariant;

  size?: ButtonSize;

  leftIcon?: ReactNode;

  rightIcon?: ReactNode;

  selected?: boolean;

  fullWidth?: boolean;
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "px-3 py-2.5 text-base",

  sm: "h-8 gap-2 px-3 py-2 text-xs",
  icon: "size-8 px-0 py-0 text-base",
};

export function Button({
  children,

  variant = "primary",

  size = "default",

  leftIcon,

  rightIcon,

  selected = false,

  fullWidth = false,

  className = "",

  type = "button",

  disabled,

  ...props
}: ButtonProps) {
  const getVariantClasses = () => {
    if (variant === "navigation") {
      if (selected) {
        return [
          "text-white",
          "bg-radial-[at_50%_0%]",
          "from-red-400",
          "to-rose-600",
          "hover:text-white",
          "hover:to-[#F90237]",
        ].join(" ");
      }

      return [
        "bg-transparent",
        "text-rose-600",
        "hover:bg-[#DE16411A]",
        "hover:text-[#DE1641]",
      ].join(" ");
    }

    if (variant === "primary") {
      return [
        "text-white",
        "bg-radial-[at_50%_0%]",
        "from-red-400",
        "to-rose-600",
        "hover:to-[#F90237]",
      ].join(" ");
    }

    if (variant === "soft") {
      return ["bg-[#DE16411A]", "text-[#DE1641]", "hover:bg-[#DE164126]"].join(" ");
    }

    if (variant === "danger") {
      return ["bg-red-500/10", "text-red-500", "hover:bg-red-500/20"].join(" ");
    }

    return ["bg-transparent", "text-gray-600", "hover:bg-gray-100"].join(" ");
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-3",

        "rounded-[100px]",

        "font-medium",

        "font-['DM_Sans']",

        "transition-all duration-200",

        "focus-visible:outline-none",

        "focus-visible:ring-2",

        "focus-visible:ring-[#DE1641]",

        "focus-visible:ring-offset-2",

        "disabled:pointer-events-none",

        "disabled:opacity-50",

        getVariantClasses(),

        sizeClasses[size],

        fullWidth ? "w-full" : "",

        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {leftIcon && (
        <span className={`flex shrink-0 items-center justify-center overflow-hidden text-current ${size === "sm" ? "size-4" : "size-5"}`}>
          {leftIcon}
        </span>
      )}

      <span>{children}</span>

      {rightIcon && (
        <span className={`flex shrink-0 items-center justify-center overflow-hidden text-current ${size === "sm" ? "size-4" : "size-5"}`}>
          {rightIcon}
        </span>
      )}
    </button>
  );
}
