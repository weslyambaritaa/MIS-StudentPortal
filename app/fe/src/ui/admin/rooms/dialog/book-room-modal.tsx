"use client";

import { CalendarDays, DoorOpen, X } from "lucide-react";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { Dropdown } from "@mis/ui/dropdown";
import { Modal } from "@mis/ui/modal";
import { Textarea } from "@mis/ui/textarea";
import { durationLabel, type RoomOption } from "./check-room-availability-modal";

export type RoomBookingReason = "MEETING" | "EVENTS" | "WORKSHOP" | "OTHERS";

export function BookRoomModal({
  room, date, startTime, durationMinutes, reason, reasonDetail, detailBooking, busy, error,
  onReasonChange, onReasonDetailChange, onDetailBookingChange, onClose, onSubmit,
}: {
  room: RoomOption;
  date: string;
  startTime: string;
  durationMinutes: number;
  reason: RoomBookingReason | "";
  reasonDetail: string;
  detailBooking: string;
  busy: boolean;
  error: string;
  onReasonChange: (reason: RoomBookingReason) => void;
  onReasonDetailChange: (value: string) => void;
  onDetailBookingChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const endTotal = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5)) + durationMinutes;
  const endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const ready = Boolean(reason && detailBooking.trim() && (reason !== "OTHERS" || reasonDetail.trim()));
  return <Modal open onClose={() => { if (!busy) onClose(); }}>
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3"><h2 className="text-2xl font-medium text-gray-600">Book the Following Room?</h2><Button size="icon" variant="ghost" aria-label="Close" onClick={onClose} disabled={busy}><X size={18}/></Button></header>
      <div className="h-px bg-zinc-950/20" />
      <section className="flex items-center gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-radial-[at_50%_0%] from-red-400 to-orange-600 text-sm font-medium text-white">{room.name.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0 flex-1"><p className="font-medium text-gray-600">{room.name}</p><p className="text-sm text-zinc-950/60">{room.capacity} Capacity</p></div>
        <Badge variant="success" showDot>Available</Badge>
      </section>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-neutral-50 p-3 text-sm text-gray-600"><p><CalendarDays className="mr-1 inline size-4 text-rose-600"/>{dateLabel}</p><p><DoorOpen className="mr-1 inline size-4 text-rose-600"/>{startTime}-{endTime}</p><p className="col-span-2">Duration: {durationLabel(durationMinutes)}</p></div>
      <Dropdown label="Reason *" required value={reason} onChange={(value) => onReasonChange(value as RoomBookingReason)} placeholder="Pick a Reason" options={[{ value: "MEETING", label: "Meeting" }, { value: "EVENTS", label: "Events" }, { value: "WORKSHOP", label: "Workshop" }, { value: "OTHERS", label: "Others" }]} className="border-rose-600" />
      {reason === "OTHERS" && <Textarea label="Specify Reason *" value={reasonDetail} onChange={(event) => onReasonDetailChange(event.target.value)} maxLength={255} placeholder="Enter the reason" />}
      <Textarea label="Detail Booking *" value={detailBooking} onChange={(event) => onDetailBookingChange(event.target.value)} maxLength={1000} placeholder="Describe this room booking" />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <footer className="flex gap-3"><Button variant="ghost" fullWidth disabled={busy} onClick={onClose}>Cancel</Button><Button fullWidth disabled={busy || !ready} leftIcon={<CalendarDays size={18}/>} onClick={onSubmit}>{busy ? "Booking…" : "Book"}</Button></footer>
    </div>
  </Modal>;
}
