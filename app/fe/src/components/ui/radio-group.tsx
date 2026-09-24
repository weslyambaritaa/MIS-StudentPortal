"use client";

import { useId } from "react";

export type RadioOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type RadioGroupProps = {
  options: RadioOption[];
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  legend?: string;
  ariaLabel?: string;
  orientation?: "vertical" | "horizontal";
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function RadioGroup({
  options,
  value,
  onValueChange,
  name,
  legend,
  ariaLabel,
  orientation = "vertical",
  required = false,
  disabled = false,
  className = "",
}: RadioGroupProps) {
  const generatedName = useId();

  return (
    <fieldset
      aria-label={legend ? undefined : ariaLabel ?? "Options"}
      className={[
        "flex min-w-0",
        orientation === "vertical" ? "flex-col gap-[18px]" : "flex-row flex-wrap gap-4",
        className,
      ].join(" ")}
    >
      {legend && <legend className="mb-2 text-sm font-medium text-gray-600">{legend}</legend>}
      {options.map((option) => {
        const checked = value === option.value;
        const optionDisabled = disabled || option.disabled;

        return (
          <label
            key={option.value}
            className={[
              "inline-flex min-w-0 items-center gap-2 text-sm text-zinc-950/60",
              optionDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name ?? generatedName}
              value={option.value}
              checked={checked}
              required={required}
              disabled={optionDisabled}
              onChange={() => onValueChange(option.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={[
                "relative size-3 shrink-0 rounded-full border border-rose-600",
                "after:absolute after:inset-[3px] after:rounded-full after:content-['']",
                checked ? "after:bg-rose-600" : "after:bg-transparent",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-rose-300 peer-focus-visible:ring-offset-2",
              ].join(" ")}
            />
            <span className="truncate font-['DM_Sans']">{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
