"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";

export type RoomFacility = { name: string; amount: string };
export type TrainingRoomFormValue = { id?: string; room_code?: string; name: string; capacity: number | string; facilities: RoomFacility[]; status: "ACTIVE" | "INACTIVE" };

export function TrainingRoomDialog({ value, busy, onClose, onSubmit }: {
  value: TrainingRoomFormValue;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<TrainingRoomFormValue, "id" | "room_code">) => void;
}) {
  const [name, setName] = useState(value.name);
  const [capacity, setCapacity] = useState(String(value.capacity || ""));
  const [status, setStatus] = useState(value.status ?? "ACTIVE");
  const [facilities, setFacilities] = useState<RoomFacility[]>(value.facilities.length ? value.facilities : [{ name: "", amount: "" }]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);
  const updateFacility = (index: number, key: keyof RoomFacility, next: string) => setFacilities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: next } : item));
  const addFacility = () => setFacilities((items) => [...items, { name: "", amount: "" }]);
  const removeFacility = (index: number) => setFacilities((items) => items.filter((_, itemIndex) => itemIndex !== index));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ name: name.trim(), capacity: Number(capacity), status, facilities: facilities.filter((item) => item.name.trim() && item.amount.trim()).map((item) => ({ name: item.name.trim(), amount: item.amount.trim() })) });
  };
  const ready = Boolean(name.trim()) && Number.isInteger(Number(capacity)) && Number(capacity) > 0 && facilities.every((item) => (!item.name.trim() && !item.amount.trim()) || (item.name.trim() && item.amount.trim()));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="training-room-dialog-title" onSubmit={submit} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5 shadow-xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <h2 id="training-room-dialog-title" className="text-2xl font-medium text-gray-600">{value.id ? "Edit Training Room" : "Add Training Room"}</h2>
          <IconButton label="Close" icon={<X size={18} />} onClick={onClose} disabled={busy} />
        </header>
        <label className="mb-4 block text-sm text-gray-600">Room Code
          <input value={value.room_code ?? "Generated automatically"} readOnly className="mt-1 h-9 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-slate-500" />
        </label>
        <label className="mb-4 block text-sm text-gray-600">Room Name *
          <input autoFocus required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Training Room A" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900 outline-none" />
        </label>
        <label className="mb-4 block text-sm text-gray-600">Capacity *
          <input required min={1} step={1} type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="Example: 25" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900 outline-none" />
        </label>
        <label className="mb-4 block text-sm text-gray-600">Status
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900 outline-none"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
        </label>
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-base font-medium text-rose-600">Room Facility</h3><Button type="button" variant="soft" leftIcon={<Plus size={15} />} onClick={addFacility}>Add Facility</Button></div>
          <div className="flex flex-col gap-3">
            {facilities.map((facility, index) => <div key={index} className="rounded-2xl border border-rose-50 bg-neutral-50 p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-zinc-500">Facility #{index + 1}</span>{facilities.length > 1 && <IconButton label={`Remove facility ${index + 1}`} icon={<Trash2 size={15} />} size="sm" variant="danger" onClick={() => removeFacility(index)} disabled={busy} />}</div>
              <label className="mb-2 block text-sm text-gray-600">Facility Name
                <input maxLength={150} value={facility.name} onChange={(event) => updateFacility(index, "name", event.target.value)} placeholder="Example: Projector" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-white px-3 text-slate-900 outline-none" />
              </label>
              <label className="block text-sm text-gray-600">Amount
                <input maxLength={30} value={facility.amount} onChange={(event) => updateFacility(index, "amount", event.target.value)} placeholder="Example: 1" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-white px-3 text-slate-900 outline-none" />
              </label>
            </div>)}
          </div>
        </section>
        <footer className="flex justify-end gap-3">
          <Button type="button" variant="navigation" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" rightIcon={<Plus size={16} />} disabled={busy || !ready}>{busy ? "Saving…" : value.id ? "Save Changes" : "Add Training Room"}</Button>
        </footer>
      </form>
    </div>
  );
}
