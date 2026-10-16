"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

export type CourseCategoryFormValue = { id?: string; category_code?: string; name: string };

export function CourseCategoryDialog({ value, busy, onClose, onSubmit }: {
  value: CourseCategoryFormValue;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string }) => void;
}) {
  const [name, setName] = useState(value.name);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit({ name: name.trim() }); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="course-category-dialog-title" onSubmit={submit} className="w-full max-w-md rounded-3xl border border-rose-50 bg-white p-5 shadow-xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <h2 id="course-category-dialog-title" className="text-2xl font-medium text-gray-600">{value.id ? "Edit Course Category" : "Add Course Category"}</h2>
          <IconButton label="Close" icon={<X size={18} />} onClick={onClose} disabled={busy} />
        </header>
        <label className="mb-4 block text-sm text-gray-600">Category Code
          <input value={value.category_code ?? "Generated automatically"} readOnly className="mt-1 h-9 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-slate-500" />
        </label>
        <label className="mb-6 block text-sm text-gray-600">Category Name
          <input autoFocus required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Data Analytics" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900 outline-none" />
        </label>
        <footer className="flex justify-end gap-3">
          <Button type="button" variant="navigation" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" rightIcon={<Plus size={16} />} disabled={busy || !name.trim()}>{busy ? "Saving…" : value.id ? "Save Changes" : "Add Category"}</Button>
        </footer>
      </form>
    </div>
  );
}
