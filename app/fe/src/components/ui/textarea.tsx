import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export function Textarea({ label, className = "", ...props }: TextareaProps) {
  return (
    <label className="block space-y-2">
      {label && <span className="block text-sm">{label}</span>}

      <textarea
        className={[
          "min-h-24 w-full resize-y",
          "rounded-2xl",
          "border border-[var(--color-primary)]",
          "bg-white px-3 py-3",
          "text-sm outline-none",
          "placeholder:text-[var(--color-text-muted)]",
          "focus:ring-2",
          "focus:ring-[var(--color-primary-soft)]",
          className,
        ].join(" ")}
        {...props}
      />
    </label>
  );
}
