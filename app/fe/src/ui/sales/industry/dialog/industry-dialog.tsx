"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

export type IndustryFormValue = { id?: string; industry_code?: string; name: string; status: "ACTIVE" | "INACTIVE" };

export function IndustryDialog({
  value,
  busy,
  onClose,
  onSubmit,
}: {
  value?: IndustryFormValue;
  busy: boolean;
  onClose: () => void;
  onSubmit: (value: { name: string; status: "ACTIVE" | "INACTIVE" }) => void;
}) {
  const [name, setName] = useState(value?.name ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(value?.status ?? "ACTIVE");
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit({ name: name.trim(), status }); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="industry-dialog-title" onSubmit={submit} className="w-full max-w-md rounded-3xl border border-rose-50 bg-white p-5 shadow-xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <h2 id="industry-dialog-title" className="text-2xl font-medium text-gray-600">{value?.id ? "Edit Industry" : "Add Industry"}</h2>
          <IconButton label="Close" icon={<X size={18} />} onClick={onClose} disabled={busy} />
        </header>
        <label className="mb-4 block text-sm text-gray-600">Industry Code
          <input value={value?.industry_code ?? "Generated automatically"} readOnly className="mt-1 h-9 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-slate-500" />
        </label>
        <label className="mb-4 block text-sm text-gray-600">Industry Name
          <input autoFocus required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Automotive" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900" />
        </label>
        <label className="mb-6 block text-sm text-gray-600">Status
          <select value={status} onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE")} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900">
            <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <footer className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : value?.id ? "Save Changes" : "Add Industry"}</Button>
        </footer>
      </form>
    </div>
  );
}
