import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LordIcon, type LordIconName } from "./lord-icon";

export type ButtonVariant = "primary" | "soft" | "ghost" | "danger" | "navigation";

export type ButtonSize = "default" | "sm" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;

  variant?: ButtonVariant;

  size?: ButtonSize;

  leftIcon?: ReactNode | LordIconName | (string & {});

  rightIcon?: ReactNode | LordIconName | (string & {});

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

  const iconHoverClass =
    variant === "primary"
      ? "group-hover:text-white group-hover:[--lord-icon-primary:#ffffff] group-hover:[--lord-icon-secondary:#ffffff]"
      : "group-hover:text-[#DE1641] group-hover:[--lord-icon-primary:#de1641] group-hover:[--lord-icon-secondary:#de1641]";

  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        "group inline-flex items-center justify-center gap-2.5",

        "rounded-[100px]",

        "font-medium",

        "font-sans",

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
        <span
          className={`inline-flex shrink-0 items-center justify-center leading-none text-current transition-colors duration-150 ${iconHoverClass} ${size === "sm" ? "size-4" : "size-5"}`}
        >
          {typeof leftIcon === "string" ? (
            <LordIcon
              src={leftIcon as LordIconName}
              size={size === "sm" ? 16 : 20}
              trigger="hover"
              target="button"
              colors={
                variant === "primary"
                  ? "primary:#ffffff,secondary:#ffffff"
                  : "primary:#de1641,secondary:#de1641"
              }
              className="shrink-0"
            />
          ) : (
            leftIcon
          )}
        </span>
      )}

      {children && <span className="leading-none">{children}</span>}

      {rightIcon && (
        <span
          className={`inline-flex shrink-0 items-center justify-center leading-none text-current transition-colors duration-150 ${iconHoverClass} ${size === "sm" ? "size-4" : "size-5"}`}
        >
          {typeof rightIcon === "string" ? (
            <LordIcon
              src={rightIcon as LordIconName}
              size={size === "sm" ? 16 : 20}
              trigger="hover"
              target="button"
              colors={
                variant === "primary"
                  ? "primary:#ffffff,secondary:#ffffff"
                  : "primary:#de1641,secondary:#de1641"
              }
              className="shrink-0"
            />
          ) : (
            rightIcon
          )}
        </span>
      )}
    </button>
  );
}

export type AddButtonProps = Omit<ButtonProps, "leftIcon"> & {
  icon?: ReactNode | LordIconName | (string & {});
};

export function AddButton({
  children,
  icon = "plus",
  variant = "primary",
  size = "default",
  ...props
}: AddButtonProps) {
  return (
    <Button variant={variant} size={size} leftIcon={icon} {...props}>
      {children}
    </Button>
  );
}

