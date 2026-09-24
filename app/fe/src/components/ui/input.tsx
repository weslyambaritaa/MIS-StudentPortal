import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, leftIcon, rightIcon, className = "", ...props },
  ref
) {
  return (
    <label className="block space-y-[3px]">
      {label && <span className="block text-sm text-gray-600">{label}</span>}

      <div
        className={[
          "flex h-9 items-center gap-2",
          "rounded-[100px] border border-rose-600 bg-neutral-50 px-3",
          "focus-within:ring-2",
          "focus-within:ring-rose-100",
          className,
        ].join(" ")}
      >
        {leftIcon && (
          <span className="shrink-0 text-[var(--color-text-secondary)]">{leftIcon}</span>
        )}

        <input
          ref={ref}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-900/40"
          {...props}
        />

        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </div>
    </label>
  );
});
