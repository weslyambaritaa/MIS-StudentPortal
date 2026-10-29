"use client";

import { CalendarDays, CircleAlert, CircleCheck, DoorOpen, ExternalLink } from "lucide-react";

import { Button } from "@mis/ui/button";
import { Modal } from "@mis/ui/modal";

/** Presentation states returned by the room availability check. */
export type CheckRoomAvailabilityStatus = "idle" | "booked" | "available";

export type RoomOption = {
  id: string;
  name: string;
  capacity: number;
};

export type RoomBookingConflict = {
  dateLabel: string;
  timeLabel: string;
  trainingCode: string;
};

type CheckRoomAvailabilityModalProps = {
  open: boolean;
  onClose: () => void;
  rooms: RoomOption[];
  selectedDate: string;
  selectedRoomId: string;
  status: CheckRoomAvailabilityStatus;
  onDateChange: (date: string) => void;
  onRoomChange: (roomId: string) => void;
  onSelectionChange: () => void;
  onCheckAvailability: () => void;
  onBookRoom: () => void;
  conflict?: RoomBookingConflict;
};

const inputClassName =
  "h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-rose-600 outline-none focus-visible:ring-2 focus-visible:ring-rose-400";

export function CheckRoomAvailabilityModal({
  open,
  onClose,
  rooms,
  selectedDate,
  selectedRoomId,
  status,
  onDateChange,
  onRoomChange,
  onSelectionChange,
  onCheckAvailability,
  onBookRoom,
  conflict,
}: CheckRoomAvailabilityModalProps) {
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const canCheck = Boolean(selectedDate && selectedRoom);
  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-h-[calc(100dvh-2rem)] max-w-[384px] overflow-y-auto"
    >
      <div className="flex flex-col items-center gap-6">
        <h2 className="self-stretch font-sans text-2xl font-medium text-rose-600">
          Check Room Availability
        </h2>

        {status === "idle" && (
          <div className="flex w-full flex-col items-center gap-2.5 rounded-3xl border border-rose-50 bg-neutral-50 p-6">
            <CalendarDays aria-hidden="true" className="size-24 text-rose-600" strokeWidth={1.2} />
            <div className="flex flex-col gap-0.5">
              <h3 className="text-center font-sans text-base font-medium text-rose-600">
                Check Room Availability
              </h3>
              <p className="text-center font-sans text-sm text-zinc-950/60">
                Pick a date &amp; room to check the room availability to start booking
              </p>
            </div>
          </div>
        )}

        {status === "booked" && (
          <div className="flex w-full flex-col items-center gap-2.5 rounded-3xl border border-red-500 bg-red-500/10 p-6">
            <CircleAlert aria-hidden="true" className="size-24 text-red-500" strokeWidth={1.2} />
            <div className="flex flex-col gap-0.5">
              <h3 className="text-center font-sans text-base font-medium text-red-500">
                This Room is Booked
              </h3>
              <p className="text-center font-sans text-sm text-zinc-950/60">
                <span className="font-medium">{selectedRoom?.name ?? "This"}</span> Room is booked
                {conflict ? ` on ${conflict.dateLabel}, ${conflict.timeLabel}` : " for the selected time"}
                {conflict && (
                  <>
                    {" for the following training: "}
                    <span className="font-bold text-red-500">{conflict.trainingCode}</span>
                  </>
                )}
                .
              </p>
            </div>
          </div>
        )}

        {status === "available" && (
          <div className="flex w-full flex-col items-center gap-2.5 rounded-3xl border border-green-500 bg-green-500/10 p-6">
            <CircleCheck aria-hidden="true" className="size-24 text-green-500" strokeWidth={1.2} />
            <div className="flex flex-col gap-0.5">
              <h3 className="text-center font-sans text-base font-medium text-green-600">
                This Room is Available
              </h3>
              <p className="text-center font-sans text-sm text-zinc-950/60">
                <span className="font-medium">{selectedRoom?.name ?? "This"}</span> Room is available
                {selectedDateLabel ? ` on ${selectedDateLabel}` : " for the selected date"}.
              </p>
            </div>
            <Button
              onClick={onBookRoom}
              disabled={!selectedRoom}
              rightIcon={<ExternalLink size={18} strokeWidth={1.7} />}
              className="mt-2 w-full"
            >
              Book This Room Now
            </Button>
          </div>
        )}

        <div className="flex w-full flex-col gap-6">
          <label className="flex flex-col gap-[3px] font-sans text-sm text-gray-600">
            <span>Pick a Date</span>
            <span className="relative block">
              <input
                aria-label="Pick a date"
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  onSelectionChange();
                  onDateChange(event.target.value);
                }}
                className={`${inputClassName} pr-10`}
              />
              <CalendarDays
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-rose-600"
              />
            </span>
          </label>

          <label className="flex flex-col gap-[3px] font-sans text-sm text-gray-600">
            <span>Pick Room Name</span>
            <span className="relative block">
              <select
                aria-label="Pick room name"
                value={selectedRoomId}
                onChange={(event) => {
                  onSelectionChange();
                  onRoomChange(event.target.value);
                }}
                className={`${inputClassName} appearance-none pr-10`}
              >
                <option value="" disabled>
                  Select a room
                </option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} - {room.capacity} Capacity
                  </option>
                ))}
              </select>
              <DoorOpen
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-slate-900/40"
              />
            </span>
          </label>

          <Button
            onClick={onCheckAvailability}
            disabled={!canCheck || status === "available"}
            rightIcon={<CalendarDays size={18} strokeWidth={1.7} />}
            className="w-full"
          >
            Check Availability &amp; Book
          </Button>
        </div>
      </div>
    </Modal>
  );
}
