import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "soft" | "ghost" | "danger" | "navigation";

type ButtonSize = "default" | "sm";

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
  default: "h-10 px-5 text-sm",

  sm: "h-8 px-4 text-xs",
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
          "bg-[radial-gradient(circle_at_center,_#FF686B_0%,_#DE1641_100%)]",
          "hover:text-white",
          "hover:bg-[radial-gradient(circle_at_center,_#FF686B_0%,_#F90237_100%)]",
        ].join(" ");
      }

      return [
        "bg-transparent",
        "text-[#DE1641]",
        "hover:bg-[#DE16411A]",
        "hover:text-[#DE1641]",
      ].join(" ");
    }

    if (variant === "primary") {
      return [
        "text-white",

        "bg-[radial-gradient(circle_at_center,_#FF686B_0%,_#DE1641_100%)]",

        "hover:bg-[radial-gradient(circle_at_center,_#FF686B_0%,_#F90237_100%)]",
      ].join(" ");
    }

    if (variant === "soft") {
      return ["bg-[#DE16411A]", "text-[#DE1641]", "hover:bg-[#DE164126]"].join(" ");
    }

    if (variant === "danger") {
      return ["bg-transparent", "text-[#DE1641]", "hover:bg-[#DE16411A]"].join(" ");
    }

    return ["bg-transparent", "text-[#DE1641]", "hover:bg-[#DE16411A]"].join(" ");
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2",

        "rounded-full",

        "font-medium",

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
        <span className="flex shrink-0 items-center justify-center text-current">{leftIcon}</span>
      )}

      <span>{children}</span>

      {rightIcon && (
        <span className="flex shrink-0 items-center justify-center text-current">{rightIcon}</span>
      )}
    </button>
  );
}
