"use client";

import { AlertCircle, CalendarDays, CheckCircle2, Search } from "lucide-react";
import { Button } from "@mis/ui/button";
import { Dropdown } from "@mis/ui/dropdown";
import { Input } from "@mis/ui/input";
import { Modal } from "@mis/ui/modal";

export type CheckRoomAvailabilityStatus = "idle" | "booked" | "available" | "loading";
export type RoomOption = { id: string; name: string; capacity: number };
export type RoomBookingConflict = { dateLabel: string; timeLabel: string; trainingCode: string | null; trainingName?: string };

type CheckRoomAvailabilityModalProps = {
  open: boolean;
  onClose: () => void;
  rooms: RoomOption[];
  selectedDate: string;
  selectedRoomId: string;
  startTime: string;
  durationMinutes: number;
  status: CheckRoomAvailabilityStatus;
  onDateChange: (date: string) => void;
  onRoomChange: (roomId: string) => void;
  onStartTimeChange: (time: string) => void;
  onDurationChange: (duration: number) => void;
  onSelectionChange: () => void;
  onCheckAvailability: () => void;
  onBookRoom: () => void;
  conflict?: RoomBookingConflict;
  error?: string;
};

const durationLabel = (minutes: number) => `${Math.floor(minutes / 60)}${minutes % 60 ? `h ${minutes % 60}m` : "h"}`;
const finishTime = (start: string, duration: number) => {
  if (!start) return "";
  const [hours, minutes] = start.split(":").map(Number);
  const end = hours * 60 + minutes + duration;
  return end >= 24 * 60 ? "" : `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
};

export function CheckRoomAvailabilityModal({
  open, onClose, rooms, selectedDate, selectedRoomId, startTime, durationMinutes, status,
  onDateChange, onRoomChange, onStartTimeChange, onDurationChange, onSelectionChange,
  onCheckAvailability, onBookRoom, conflict, error,
}: CheckRoomAvailabilityModalProps) {
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const endTime = finishTime(startTime, durationMinutes);
  const canCheck = Boolean(selectedDate && selectedRoom && startTime && endTime && durationMinutes >= 15 && durationMinutes <= 720);
  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const roomOptions = rooms.map((room) => ({ value: room.id, label: `${room.name} - ${room.capacity} Capacity` }));

  return (
    <Modal open={open} onClose={onClose} className="max-h-[calc(100dvh-2rem)] max-w-[480px] overflow-y-auto">
      <div className="flex flex-col items-center gap-6">
        <h2 className="self-stretch font-sans text-2xl font-medium text-rose-600">Check Room Availability</h2>

        {status === "idle" && <div className="flex w-full flex-col items-center gap-2.5 rounded-3xl border border-rose-50 bg-neutral-50 p-6">
          <Search aria-hidden="true" className="size-20 text-rose-600" strokeWidth={1.2} />
          <div className="flex flex-col gap-0.5"><h3 className="text-center text-base font-medium text-gray-600">Check Room Availability</h3><p className="text-center text-sm text-zinc-950/60">Choose a date, time, and room to check availability.</p></div>
        </div>}

        {status === "loading" && <div role="status" className="w-full rounded-3xl border border-rose-50 bg-neutral-50 p-8 text-center text-sm text-zinc-600">Checking room availability…</div>}

        {status === "booked" && <div className="flex w-full flex-col items-center gap-2.5 rounded-3xl border border-red-500 bg-red-500/10 p-6">
          <AlertCircle aria-hidden="true" className="size-20 text-red-500" strokeWidth={1.2} />
          <div className="flex flex-col gap-0.5"><h3 className="text-center text-base font-medium text-red-500">This Room is Booked</h3><p className="text-center text-sm text-zinc-950/60"><span className="font-medium">{selectedRoom?.name ?? "This room"}</span> is booked on {selectedDateLabel}, {conflict?.timeLabel ?? `${startTime}-${endTime}`}{conflict && <> for <span className="font-bold text-red-500">{conflict.trainingCode ?? conflict.trainingName ?? "another booking"}</span>{conflict.trainingCode && conflict.trainingName ? ` · ${conflict.trainingName}` : ""}</>}.</p></div>
        </div>}

        {status === "available" && <div className="flex w-full flex-col items-center gap-2.5 rounded-3xl border border-green-500 bg-green-500/10 p-6">
          <CheckCircle2 aria-hidden="true" className="size-20 text-green-500" strokeWidth={1.2} />
          <div className="flex flex-col gap-0.5"><h3 className="text-center text-base font-medium text-green-600">This Room is Available</h3><p className="text-center text-sm text-zinc-950/60"><span className="font-medium">{selectedRoom?.name}</span> Room is available on {selectedDateLabel}, {startTime}-{endTime}.</p></div>
          <Button onClick={onBookRoom} disabled={!selectedRoom} rightIcon={<CalendarDays size={18} />} className="mt-2 w-full">Book This Room Now</Button>
        </div>}

        <div className="flex w-full flex-col gap-4">
          <Input label="Pick a Date" type="date" value={selectedDate} onChange={(event) => { onSelectionChange(); onDateChange(event.target.value); }} rightIcon={<CalendarDays size={18} />} hideNativeDateIcon className="border-rose-600" />
          <Dropdown label="Pick Room Name" value={selectedRoomId} onChange={(value) => { onSelectionChange(); onRoomChange(value); }} placeholder="Select a room" options={roomOptions} className="border-rose-600" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Time" type="time" value={startTime} onChange={(event) => { onSelectionChange(); onStartTimeChange(event.target.value); }} className="border-rose-600" />
            <Input label="Duration (minutes)" type="number" min={15} max={720} step={15} value={durationMinutes} onChange={(event) => { onSelectionChange(); onDurationChange(Number(event.target.value)); }} className="border-rose-600" />
          </div>
          {(durationMinutes < 15 || durationMinutes > 720) && <p role="alert" className="text-sm text-red-600">Duration must be between 15 and 720 minutes.</p>}
          {Boolean(startTime && !endTime) && <p role="alert" className="text-sm text-red-600">This duration would continue past midnight. Choose an earlier start time or shorter duration.</p>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button onClick={onCheckAvailability} disabled={!canCheck || status === "loading"} rightIcon={<CalendarDays size={18} />} className="w-full">Check Availability &amp; Book</Button>
        </div>
      </div>
    </Modal>
  );
}

export { durationLabel };
