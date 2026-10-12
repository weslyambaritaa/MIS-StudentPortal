"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

export type AuditDetail = {
  created_at: string;
  actor_subject: string | null;
  actor_name: string | null;
  actor_type: string;
  active_role: string | null;
  process_name: string | null;
  action: string;
  object_type: string;
  object_id: string | null;
  ip_address: string | null;
  source_service: string;
  data_before: string | null;
  data_after: string | null;
};

function parseSnapshot(snapshot: string | null): Record<string, unknown> {
  if (!snapshot) return {};
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* Show empty snapshot if historical data is not valid JSON. */ }
  return {};
}

function printable(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AuditDetailDialog({ entry, onClose }: { entry: AuditDetail; onClose: () => void }) {
  const before = parseSnapshot(entry.data_before);
  const after = parseSnapshot(entry.data_after);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5 shadow-xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="audit-detail-title" className="text-2xl font-medium text-gray-600">Detail Audit Trail</h2>
            <p className="mt-1 text-sm text-zinc-500">{entry.action} · {entry.object_type}{entry.object_id ? ` · ${entry.object_id}` : ""}</p>
          </div>
          <IconButton label="Tutup detail" icon={<X size={18} />} onClick={onClose} />
        </header>

        <dl className="mt-5 grid gap-3 rounded-2xl bg-neutral-50 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-zinc-500">Waktu</dt><dd className="mt-0.5 font-medium text-zinc-800">{new Date(entry.created_at).toLocaleString("id-ID")}</dd></div>
          <div><dt className="text-zinc-500">Pelaku</dt><dd className="mt-0.5 font-medium text-zinc-800">{entry.actor_name ?? entry.actor_subject ?? entry.process_name ?? "—"}</dd></div>
          <div><dt className="text-zinc-500">Role</dt><dd className="mt-0.5 font-medium text-zinc-800">{entry.active_role ?? (entry.actor_type === "SYSTEM" ? "SYSTEM" : "—")}</dd></div>
          <div><dt className="text-zinc-500">IP address</dt><dd className="mt-0.5 font-medium text-zinc-800">{entry.ip_address ?? "—"}</dd></div>
          {entry.process_name && <div><dt className="text-zinc-500">Nama proses</dt><dd className="mt-0.5 font-medium text-zinc-800">{entry.process_name}</dd></div>}
          <div><dt className="text-zinc-500">Sumber service</dt><dd className="mt-0.5 font-medium text-zinc-800">{entry.source_service}</dd></div>
        </dl>

        <h3 className="mt-6 text-base font-medium text-rose-600">Perubahan field</h3>
        {fields.length === 0 ? <p className="mt-2 rounded-xl bg-neutral-50 p-4 text-sm text-zinc-500">Tidak ada snapshot field untuk kejadian ini.</p> : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-rose-50">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-neutral-100 text-xs uppercase text-gray-600"><tr><th className="px-3 py-2">Field</th><th className="px-3 py-2">Sebelum</th><th className="px-3 py-2">Sesudah</th></tr></thead>
              <tbody>{fields.map((field) => <tr key={field} className="border-t border-rose-50"><th className="px-3 py-2 font-medium text-zinc-700">{field}</th><td className="max-w-56 break-words px-3 py-2 text-zinc-600">{printable(before[field])}</td><td className="max-w-56 break-words px-3 py-2 text-zinc-600">{printable(after[field])}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
