"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Star, X } from "lucide-react";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";
import { Modal } from "@mis/ui/modal";

type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
type AvailableTrainer = { id: string; name: string; specialization: string; email: string | null; status: string; rating: number | string; availability: "AVAILABLE" };

function todayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function TrainerBookingDialog({ api, onClose, onBooked }: { api: ApiRequest; onClose: () => void; onBooked: () => void }) {
  const [date, setDate] = useState(todayDate);
  const [trainers, setTrainers] = useState<AvailableTrainer[]>([]);
  const [trainerId, setTrainerId] = useState("");
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [detailBooking, setDetailBooking] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedTrainer = useMemo(() => trainers.find((trainer) => trainer.id === trainerId) ?? null, [trainers, trainerId]);

  useEffect(() => {
    let active = true;
    if (!date) {
      setTrainers([]);
      setTrainerId("");
      setLoadingOptions(false);
      setError("");
      return () => { active = false; };
    }
    setLoadingOptions(true);
    setError("");
    setTrainerId("");
    api<{ items: AvailableTrainer[] }>(`/api/v1/internal/trainers/booking-options?date=${encodeURIComponent(date)}`)
      .then((result) => { if (active) setTrainers(result.items); })
      .catch((cause) => { if (active) { setTrainers([]); setError(cause instanceof Error ? cause.message : "Could not load available Trainers."); } })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, [api, date]);

  async function submit() {
    if (!trainerId || !date || !reason || (reason === "OTHERS" && !reasonDetail.trim()) || !detailBooking.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/internal/trainers/bookings", {
        method: "POST",
        body: JSON.stringify({ trainerId, date, reason, ...(reason === "OTHERS" ? { reasonDetail: reasonDetail.trim() } : {}), detailBooking: detailBooking.trim() }),
      });
      onBooked();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not book this Trainer.");
    } finally {
      setBusy(false);
    }
  }

  return <Modal open onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <h2 className="text-2xl font-medium text-gray-600">Book a Trainer?</h2>
        <IconButton label="Close" icon={<X size={18}/>} onClick={onClose} disabled={busy}/>
      </header>
      <div className="h-px bg-zinc-950/20" />
      {selectedTrainer && <section className="flex items-center gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-orange-600 text-base font-medium text-white">{selectedTrainer.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-base font-medium text-gray-600">{selectedTrainer.name}</p><p className="truncate text-sm font-medium text-zinc-600">{selectedTrainer.specialization}</p></div>
        <span className="flex shrink-0 items-center gap-1 text-base font-medium text-orange-400"><Star size={16} fill="currentColor"/>{Number(selectedTrainer.rating).toFixed(1)}</span>
        <span className="shrink-0 rounded-full border border-green-500 bg-green-500/20 px-3 py-1 text-xs font-medium text-green-600">Available</span>
      </section>}
      <label className="block text-sm text-gray-600">Trainer *
        <span className="relative mt-1 block"><select required value={trainerId} onChange={(event) => setTrainerId(event.target.value)} disabled={loadingOptions || busy} className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-sm text-gray-600 disabled:opacity-60"><option value="">{loadingOptions ? "Loading available Trainers…" : "Pick a Trainer"}</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name} · {trainer.specialization}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-900/50"/></span>
        {!loadingOptions && !trainers.length && !error && <span className="mt-1 block text-xs text-zinc-500">No Trainer is available on this date.</span>}
      </label>
      <label className="block text-sm text-gray-600">Reason *<span className="relative mt-1 block"><select required value={reason} onChange={(event) => { setReason(event.target.value); if (event.target.value !== "OTHERS") setReasonDetail(""); }} className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-sm text-gray-600"><option value="">Pick a Reason</option><option value="MEETING">Meeting</option><option value="EVENTS">Events</option><option value="WORKSHOP">Workshop</option><option value="OTHERS">Others</option></select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-900/50"/></span></label>
      {reason === "OTHERS" && <label className="block text-sm text-gray-600">Specify Reason *<textarea required value={reasonDetail} onChange={(event) => setReasonDetail(event.target.value)} maxLength={2000} placeholder="Enter the reason for this booking" className="mt-1 min-h-20 w-full rounded-xl border border-rose-600 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-100"/></label>}
      <label className="block text-sm text-gray-600">Date *<span className="relative mt-1 block"><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-sm text-rose-600"/><CalendarDays size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600"/></span><span className="mt-1 block text-xs text-zinc-500">Trainer is reserved for the full day.</span></label>
      <label className="block text-sm text-gray-600">Detail Booking *<textarea required value={detailBooking} onChange={(event) => setDetailBooking(event.target.value)} maxLength={4000} placeholder="Add booking details" className="mt-1 min-h-20 w-full rounded-xl border border-rose-600 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-100"/></label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <footer className="flex gap-3"><Button variant="ghost" fullWidth disabled={busy} onClick={onClose}>Cancel</Button><Button fullWidth disabled={busy || loadingOptions || !selectedTrainer || !date || !reason || (reason === "OTHERS" && !reasonDetail.trim()) || !detailBooking.trim()} leftIcon={<CalendarDays size={18}/>} onClick={() => void submit()}>{busy ? "Booking…" : "Book"}</Button></footer>
    </div>
  </Modal>;
}
