"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Star, X } from "lucide-react";
import { Button } from "@mis/ui/button";
import { Dropdown } from "@mis/ui/dropdown";
import { IconButton } from "@mis/ui/icon-button";
import { Input } from "@mis/ui/input";
import { Modal } from "@mis/ui/modal";
import { Textarea } from "@mis/ui/textarea";

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
      <div>
        <Dropdown label="Trainer *" required value={trainerId} onChange={setTrainerId} disabled={loadingOptions || busy} placeholder={loadingOptions ? "Loading available Trainers…" : "Pick a Trainer"} options={trainers.map((trainer) => ({ value: trainer.id, label: `${trainer.name} · ${trainer.specialization}` }))} className="border-rose-600" />
        {!loadingOptions && !trainers.length && !error && <span className="mt-1 block text-xs text-zinc-500">No Trainer is available on this date.</span>}
      </div>
      <Dropdown label="Reason *" required value={reason} onChange={(value) => { setReason(value); if (value !== "OTHERS") setReasonDetail(""); }} placeholder="Pick a Reason" options={[{ value: "MEETING", label: "Meeting" }, { value: "EVENTS", label: "Events" }, { value: "WORKSHOP", label: "Workshop" }, { value: "OTHERS", label: "Others" }]} className="border-rose-600" />
      {reason === "OTHERS" && <Textarea label="Specify Reason *" required value={reasonDetail} onChange={(event) => setReasonDetail(event.target.value)} maxLength={2000} placeholder="Enter the reason for this booking" />}
      <div><Input label="Date *" required type="date" value={date} onChange={(event) => setDate(event.target.value)} rightIcon={<CalendarDays size={16}/>} className="border-rose-600 text-rose-600"/><span className="mt-1 block text-xs text-zinc-500">Trainer is reserved for the full day.</span></div>
      <Textarea label="Detail Booking *" required value={detailBooking} onChange={(event) => setDetailBooking(event.target.value)} maxLength={4000} placeholder="Add booking details" />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <footer className="flex gap-3"><Button variant="ghost" fullWidth disabled={busy} onClick={onClose}>Cancel</Button><Button fullWidth disabled={busy || loadingOptions || !selectedTrainer || !date || !reason || (reason === "OTHERS" && !reasonDetail.trim()) || !detailBooking.trim()} leftIcon={<CalendarDays size={18}/>} onClick={() => void submit()}>{busy ? "Booking…" : "Book"}</Button></footer>
    </div>
  </Modal>;
}
