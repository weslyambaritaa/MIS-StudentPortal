"use client";

import { forwardRef, useImperativeHandle, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { LordIcon, type LordIconName } from "./lord-icon";

export type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> & {
  /** Optional label text above the input */
  label?: ReactNode;

  /** Dynamic left icon */
  leftIcon?: ReactNode | LordIconName | (string & {});

  /** Custom classes for the outer wrapper */
  containerClassName?: string;

  /** Size variant */
  size?: "sm" | "default" | "lg";

  /** Callback when numeric value changes */
  onValueChange?: (val: number | null) => void;
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

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    label,
    leftIcon,
    className = "",
    containerClassName = "",
    size = "default",
    disabled,
    min,
    max,
    step = 1,
    value,
    defaultValue,
    onChange,
    onValueChange,
    ...props
  },
  ref
) {
  const innerRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

  const sizeClasses = {
    sm: "h-8 px-2.5 text-xs",
    default: "h-9 px-3 text-sm",
    lg: "h-11 px-4 text-base",
  }[size];

  const iconSizes = {
    sm: 18,
    default: 20,
    lg: 22,
  }[size];

  const lordButtonSizes = {
    sm: 16,
    default: 18,
    lg: 20,
  }[size];

  const updateInputValue = (nextVal: number) => {
    const input = innerRef.current;
    if (!input) return;

    const clamped = (() => {
      let v = nextVal;
      if (min !== undefined && v < Number(min)) v = Number(min);
      if (max !== undefined && v > Number(max)) v = Number(max);
      return v;
    })();

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(input, String(clamped));
    } else {
      input.value = String(clamped);
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    onValueChange?.(clamped);
  };

  const handleStep = (direction: "up" | "down") => {
    if (disabled) return;
    const input = innerRef.current;
    const currentVal = input ? parseFloat(input.value) : NaN;
    const numStep = step === "any" ? 1 : Number(step) || 1;

    let nextVal: number;
    if (isNaN(currentVal)) {
      if (min !== undefined) nextVal = Number(min);
      else if (direction === "up") nextVal = numStep;
      else nextVal = 0;
    } else {
      nextVal = direction === "up" ? currentVal + numStep : currentVal - numStep;
    }

    // Fix floating point math e.g. 0.1 + 0.2
    if (!Number.isInteger(numStep)) {
      const precision = (String(numStep).split(".")[1] || "").length;
      nextVal = parseFloat(nextVal.toFixed(precision));
    }

    updateInputValue(nextVal);
  };

  const renderIcon = (icon: ReactNode | LordIconName | (string & {})) => {
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
      {label && (
        <span className="block text-sm font-medium text-gray-600">
          {renderInputLabel(label, props.required)}
        </span>
      )}

      <div
        className={[
          "group/input flex items-center gap-1.5",
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
        {renderIcon(leftIcon)}

        <input
          ref={innerRef}
          type="number"
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          value={value}
          defaultValue={defaultValue}
          onChange={(e) => {
            onChange?.(e);
            const num = parseFloat(e.target.value);
            onValueChange?.(isNaN(num) ? null : num);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-zinc-950/40 placeholder:transition-all group-hover/input:placeholder:text-rose-600 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          {...props}
        />

        {/* Arrow up and down using chevron circle up and down side by side on the right */}
        <div className="flex items-center gap-1 shrink-0 -mr-1">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={(e) => {
              e.preventDefault();
              handleStep("up");
            }}
            className="flex items-center justify-center p-0.5 rounded-full text-zinc-500 hover:text-rose-600 hover:bg-rose-50 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Increase"
            aria-label="Increase"
          >
            <LordIcon
              src="chevron-circle-up"
              size={lordButtonSizes}
              trigger="hover"
              colors="primary:#6b7280,secondary:#9ca3af"
              className="hover:[--lord-icon-primary:#de1641] hover:[--lord-icon-secondary:#de1641]"
            />
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={(e) => {
              e.preventDefault();
              handleStep("down");
            }}
            className="flex items-center justify-center p-0.5 rounded-full text-zinc-500 hover:text-rose-600 hover:bg-rose-50 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Decrease"
            aria-label="Decrease"
          >
            <LordIcon
              src="chevron-circle-down"
              size={lordButtonSizes}
              trigger="hover"
              colors="primary:#6b7280,secondary:#9ca3af"
              className="hover:[--lord-icon-primary:#de1641] hover:[--lord-icon-secondary:#de1641]"
            />
          </button>
        </div>
      </div>
    </label>
  );
});

export const NumberInputBox = NumberInput;

