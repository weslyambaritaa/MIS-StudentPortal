import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export function Textarea({ label, className = "", ...props }: TextareaProps) {
  return (
    <label className="block space-y-[3px]">
      {label && <span className="block text-sm text-gray-600">{label}</span>}

      <textarea
        className={[
          "min-h-16 w-full resize-y rounded-xl border border-rose-600 bg-neutral-50 px-3 py-2.5",
          "text-sm text-slate-900 outline-none placeholder:text-slate-900/40",
          "focus:ring-2",
          "focus:ring-rose-100",
          className,
        ].join(" ")}
        {...props}
      />
    </label>
  );
}
