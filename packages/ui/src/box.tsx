"use client";

import type { ChangeEvent, ReactNode } from "react";
import { LordIcon, type LordIconName } from "./lord-icon";

export type BoxOption = {
  label: string;
  value: string;
};

export type BoxProps = {
  label?: ReactNode;
  placeholder?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  type?: string;
  options?: BoxOption[];
  multiline?: boolean;
  rows?: number;
  leftIcon?: ReactNode | LordIconName | (string & {});
  rightIcon?: ReactNode | LordIconName | (string & {});
  className?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
};

export function Box({
  label,
  placeholder = "Placeholder",
  value,
  onChange,
  type = "text",
  options,
  multiline = false,
  rows = 3,
  leftIcon,
  rightIcon,
  className = "",
  name,
  required,
  disabled,
}: BoxProps) {
  const controlClass = [
    "group/box flex w-full items-center gap-2 border border-zinc-950/60 bg-neutral-50",
    "transition-colors duration-150",
    "hover:border-rose-600",
    "focus-within:border-rose-600 focus-within:ring-2 focus-within:ring-rose-100",
    multiline ? "min-h-16 items-start rounded-xl p-3" : "h-9 rounded-full px-3",
    disabled ? "opacity-50 cursor-not-allowed" : "",
  ].join(" ");

  const fieldClass = [
    "min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none",
    "placeholder:text-zinc-950 placeholder:opacity-40 placeholder:transition-all group-hover/box:placeholder:text-rose-600 group-hover/box:placeholder:opacity-100 disabled:opacity-50",
    className,
  ].join(" ");

  const renderIcon = (icon: ReactNode | LordIconName | (string & {}), position: "left" | "right") => {
    if (!icon) return null;
    if (typeof icon === "string") {
      return (
        <LordIcon
          src={icon as LordIconName}
          size={20}
          trigger="hover"
          target="label,div"
          colors="primary:#6b7280,secondary:#9ca3af"
          className="shrink-0 transition-colors duration-150 group-hover/box:[--lord-icon-primary:#de1641] group-hover/box:[--lord-icon-secondary:#de1641] group-focus-within/box:[--lord-icon-primary:#de1641] group-focus-within/box:[--lord-icon-secondary:#de1641]"
        />
      );
    }
    return (
      <span className="shrink-0 text-zinc-950/60 transition-colors duration-150 group-hover/box:text-rose-600 group-focus-within/box:text-rose-600">
        {icon}
      </span>
    );
  };

  return (
    <label className="flex min-w-0 flex-col gap-[3px] text-sm font-medium text-gray-600">
      {label && <span>{label}</span>}
      <span className={controlClass}>
        {renderIcon(leftIcon, "left")}
        {options ? (
          <div className="relative flex min-w-0 flex-1 items-center">
            <select
              name={name}
              value={value}
              onChange={onChange}
              required={required}
              disabled={disabled}
              className={`${fieldClass} appearance-none pr-6 cursor-pointer ${
                !value ? "text-zinc-950 opacity-40 group-hover/box:text-rose-600 group-hover/box:opacity-100" : ""
              }`}
            >
              <option value="">{placeholder}</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <LordIcon
              src="chevron-down"
              size={20}
              trigger="hover"
              target="select"
              colors="primary:#6b7280,secondary:#9ca3af"
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 shrink-0 transition-colors duration-150 group-hover/box:[--lord-icon-primary:#de1641] group-hover/box:[--lord-icon-secondary:#de1641]"
            />
          </div>
        ) : multiline ? (
          <textarea
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            required={required}
            disabled={disabled}
            className={`${fieldClass} resize-y`}
          />
        ) : (
          <input
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className={`${fieldClass} min-w-0 flex-1`}
          />
        )}
        {renderIcon(rightIcon, "right")}
      </span>
    </label>
  );
}

