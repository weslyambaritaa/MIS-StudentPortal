import type { ChangeEvent, ReactNode } from "react";

type BoxOption = {
  label: string;
  value: string;
};

type BoxProps = {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  type?: string;
  options?: BoxOption[];
  multiline?: boolean;
  rows?: number;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
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
    "flex w-full items-center gap-2 border border-rose-600 bg-neutral-50",
    "focus-within:ring-2 focus-within:ring-rose-100",
    multiline ? "min-h-16 items-start rounded-xl p-3" : "h-9 rounded-[100px] px-3",
    disabled ? "opacity-50" : "",
  ].join(" ");
  const fieldClass = [
    "min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none",
    "placeholder:text-slate-900/40 disabled:opacity-50",
    className,
  ].join(" ");

  return (
    <label className="flex min-w-0 flex-col gap-[3px] text-sm text-gray-600">
      {label && <span>{label}</span>}
      <span className={controlClass}>
        {leftIcon && <span className="shrink-0 text-slate-900/40">{leftIcon}</span>}
        {options ? (
          <select
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            className={`${fieldClass} appearance-none`}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
        {rightIcon && <span className="shrink-0 text-rose-600">{rightIcon}</span>}
      </span>
    </label>
  );
}
