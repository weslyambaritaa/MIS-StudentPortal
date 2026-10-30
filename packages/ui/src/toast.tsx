"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { LordIcon } from "./lord-icon";

type ToastItem = { id: number; message: string };
type ToastContextValue = { showToast: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message }]);
    timers.current.set(id, setTimeout(() => dismissToast(id), 4000));
  }, [dismissToast]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-green-500 bg-green-500/20 px-4 py-3 text-sm text-green-950 shadow-lg shadow-green-500/10 backdrop-blur-sm animate-in slide-in-from-right duration-300 ease-out transition-all"
          >
            <LordIcon
              src="check-circle"
              size={20}
              trigger="loop"
              colors="primary:#22c55e,secondary:#22c55e"
              className="mt-0.5 shrink-0"
            />
            <p className="min-w-0 flex-1 font-medium">{toast.message}</p>
            <button
              type="button"
              aria-label="Close notification"
              onClick={() => dismissToast(toast.id)}
              className="rounded-full p-1 text-green-700 hover:bg-green-500/30 hover:text-green-950 transition-colors"
            >
              <LordIcon
                src="cross"
                size={16}
                trigger="hover"
                colors="primary:#15803d,secondary:#15803d"
              />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
