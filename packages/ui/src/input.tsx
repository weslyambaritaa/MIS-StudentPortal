"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { LordIcon, type LordIconName } from "./lord-icon";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** Optional label text above the input */
  label?: ReactNode;

  /** Dynamic left icon: can be a LordIcon name shorthand (e.g. "search", "mail", "user") or any ReactNode */
  leftIcon?: ReactNode | LordIconName | (string & {});

  /** Dynamic right icon: can be a LordIcon name shorthand or any ReactNode */
  rightIcon?: ReactNode | LordIconName | (string & {});

  /** Optional action for the right icon, such as opening a native picker. */
  onRightIconClick?: () => void;
  rightIconActionLabel?: string;

  /** Custom classes for the outer label wrapper */
  containerClassName?: string;

  /** Size variant */
  size?: "sm" | "default" | "lg";

  /** Hide the browser's built-in calendar glyph while keeping the date input usable. */
  hideNativeDateIcon?: boolean;
};

function renderInputLabel(label: ReactNode, required?: boolean) {
  if (!label) return null;
  if (typeof label === "string") {
    const starMatch = label.match(/^(.*?)\s*\*(\s*.*)$/);
    if (starMatch) {
      return (
        <>
          {starMatch[1]}
          <span className="text-[#de1641] font-semibold"> *</span>
          {starMatch[2]}
        </>
      );
    }
    if (required) {
      return (
        <>
          {label}
          <span className="text-[#de1641] font-semibold ml-0.5">*</span>
        </>
      );
    }
  }
  return (
    <>
      {label}
      {required && <span className="text-[#de1641] font-semibold ml-0.5">*</span>}
    </>
  );
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    leftIcon,
    rightIcon,
    onRightIconClick,
    rightIconActionLabel = "Open picker",
    className = "",
    containerClassName = "",
    size = "default",
    hideNativeDateIcon = false,
    disabled,
    ...props
  },
  ref
) {
  const sizeClasses = {
    sm: "h-8 px-2.5 text-xs",
    default: "h-9 px-3 text-sm",
    lg: "h-11 px-4 text-base",
  }[size];

  const iconSizes = {
    sm: 20,
    default: 20,
    lg: 22,
  }[size];

  const renderIcon = (icon: ReactNode | LordIconName | (string & {}), position: "left" | "right") => {
    if (!icon) return null;
    if (typeof icon === "string") {
      return (
        <LordIcon
          src={icon as LordIconName}
          size={iconSizes}
          trigger="hover"
          target="div,input"
          colors="primary:#6b7280,secondary:#9ca3af"
          className="shrink-0 transition-colors duration-150 group-hover/input:[--lord-icon-primary:#de1641] group-hover/input:[--lord-icon-secondary:#de1641] group-focus-within/input:[--lord-icon-primary:#de1641] group-focus-within/input:[--lord-icon-secondary:#de1641]"
        />
      );
    }
    return (
      <span className="shrink-0 text-zinc-950/60 transition-colors duration-150 group-hover/input:text-rose-600 group-focus-within/input:text-rose-600">
        {icon}
      </span>
    );
  };

  return (
    <label className={`block space-y-[3px] ${containerClassName}`}>
      {label && <span className="block text-sm font-medium text-gray-600">{renderInputLabel(label, props.required)}</span>}

      <div
        className={[
          "group/input flex items-center gap-2",
          "rounded-full border border-zinc-950/60 bg-neutral-50",
          "transition-colors duration-150",
          "hover:border-rose-600",
          "focus-within:border-rose-600 focus-within:ring-2 focus-within:ring-rose-100",
          disabled ? "opacity-50 cursor-not-allowed" : "",
          sizeClasses,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {renderIcon(leftIcon, "left")}

        <input
          ref={ref}
          disabled={disabled}
          className={`min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-zinc-950/40 placeholder:transition-all group-hover/input:placeholder:text-rose-600 disabled:cursor-not-allowed ${hideNativeDateIcon ? "[&::-webkit-calendar-picker-indicator]:opacity-0" : ""}`}
          {...props}
        />

        {onRightIconClick && rightIcon ? (
          <button
            type="button"
            aria-label={rightIconActionLabel}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRightIconClick();
            }}
            disabled={disabled}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:cursor-not-allowed"
          >
            {renderIcon(rightIcon, "right")}
          </button>
        ) : renderIcon(rightIcon, "right")}
      </div>
    </label>
  );
});

