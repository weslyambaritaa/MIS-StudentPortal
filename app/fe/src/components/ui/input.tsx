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
    <label className="block space-y-2">
      {label && <span className="block text-sm text-[var(--color-text-primary)]">{label}</span>}

      <div
        className={[
          "flex min-h-10 items-center gap-2",
          "rounded-full",
          "border border-[var(--color-primary)]",
          "bg-white px-3",
          "focus-within:ring-2",
          "focus-within:ring-[var(--color-primary-soft)]",
          className,
        ].join(" ")}
      >
        {leftIcon && (
          <span className="shrink-0 text-[var(--color-text-secondary)]">{leftIcon}</span>
        )}

        <input
          ref={ref}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
          {...props}
        />

        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </div>
    </label>
  );
});
