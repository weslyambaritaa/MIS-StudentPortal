"use client";

import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, children, className = "" }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative z-10",
          "w-full max-w-[480px]",
          "rounded-3xl border border-rose-50",
          "bg-white",
          "p-5",
          className,
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
