import type { ReactNode } from "react";

export function DashboardWelcomePanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-6 rounded-3xl border border-rose-50 bg-white p-6">
    <h2 className="text-2xl font-medium text-zinc-950">{title}</h2>
    {children}
  </section>;
}
