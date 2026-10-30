"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { DataTable } from "@mis/ui/data-table";
import { Dropdown } from "@mis/ui/dropdown";
import { Input } from "@mis/ui/input";
import { Pagination } from "@mis/ui/pagination";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@mis/ui/toast";
import { BookRoomModal, type RoomBookingReason } from "./dialog/book-room-modal";
import { CheckRoomAvailabilityModal, type CheckRoomAvailabilityStatus, type RoomBookingConflict, type RoomOption } from "./dialog/check-room-availability-modal";

type RoomBooking = { id: string; booking_date: string; start_time: string; end_time: string; reason: RoomBookingReason; reason_detail: string | null; detail_booking: string; room: { name: string; room_code: string } };
type BookingList = { items: RoomBooking[]; page: number; pageSize: number; total: number };
type Availability = { available: boolean; conflicts: Array<{ kind: string; className: string; classCode: string | null; startTime: string; endTime: string }> };
const REASONS = [{ value: "MEETING", label: "Meeting" }, { value: "EVENTS", label: "Events" }, { value: "WORKSHOP", label: "Workshop" }, { value: "OTHERS", label: "Others" }];
const reasonLabel = (reason: string, detail?: string | null) => reason === "OTHERS" ? detail || "Others" : REASONS.find((item) => item.value === reason)?.label ?? reason;
const getEndTime = (time: string, duration: number) => {
  if (!time || !Number.isFinite(duration)) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const end = hours * 60 + minutes + duration;
  if (end > 24 * 60) return "";
  return `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
};

export default function BookingRoomPage() {
  const api = useApi();
  const { showToast } = useToast();
  const [items, setItems] = useState<RoomBooking[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [availabilityStatus, setAvailabilityStatus] = useState<CheckRoomAvailabilityStatus>("idle");
  const [availabilityError, setAvailabilityError] = useState("");
  const [conflict, setConflict] = useState<RoomBookingConflict | undefined>();
  const [bookOpen, setBookOpen] = useState(false);
  const [bookingReason, setBookingReason] = useState<RoomBookingReason | "">("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [detailBooking, setDetailBooking] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "8", reason: reasonFilter, search });
      const result = await api<BookingList>(`/api/v1/internal/rooms/bookings?${query}`);
      setItems(result.items); setTotal(result.total); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load room bookings."); }
    finally { setLoading(false); }
  }, [api, page, reasonFilter, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setSearch(draftSearch.trim()); }, 250);
    return () => window.clearTimeout(timer);
  }, [draftSearch]);

  const openAvailability = async () => {
    setModalOpen(true); setAvailabilityStatus("idle"); setAvailabilityError(""); setConflict(undefined);
    try {
      const result = await api<{ items: RoomOption[] }>("/api/v1/internal/rooms/eligible?participantCount=1");
      setRooms(result.items);
    } catch (cause) { setAvailabilityError(cause instanceof Error ? cause.message : "Could not load Training Rooms."); }
  };

  const resetAvailability = () => { setAvailabilityStatus("idle"); setAvailabilityError(""); setConflict(undefined); };
  const checkAvailability = async () => {
    const room = rooms.find((item) => item.id === selectedRoomId);
    const endTime = getEndTime(startTime, durationMinutes);
    if (!room || !selectedDate || !startTime || !endTime || durationMinutes < 15) return;
    setAvailabilityStatus("loading"); setAvailabilityError(""); setConflict(undefined);
    try {
      const query = new URLSearchParams({ roomId: room.id, date: selectedDate, startTime, endTime });
      const result = await api<Availability>(`/api/v1/internal/rooms/availability?${query}`);
      setAvailabilityStatus(result.available ? "available" : "booked");
      const firstConflict = result.conflicts[0];
      if (firstConflict) setConflict({ dateLabel: selectedDate, timeLabel: `${firstConflict.startTime}-${firstConflict.endTime}`, trainingCode: firstConflict.classCode, trainingName: firstConflict.className });
    } catch (cause) { setAvailabilityStatus("idle"); setAvailabilityError(cause instanceof Error ? cause.message : "Could not check room availability."); }
  };

  const saveBooking = async () => {
    const endTime = getEndTime(startTime, durationMinutes);
    if (!selectedRoomId || !selectedDate || !endTime || !bookingReason) return;
    setBookingBusy(true); setBookingError("");
    try {
      await api("/api/v1/internal/rooms/bookings", { method: "POST", body: JSON.stringify({ roomId: selectedRoomId, date: selectedDate, startTime, durationMinutes, reason: bookingReason, reasonDetail, detailBooking }) });
      showToast("Room booked successfully.");
      setBookOpen(false); setModalOpen(false); setBookingReason(""); setReasonDetail(""); setDetailBooking("");
      await load();
    } catch (cause) { setBookingError(cause instanceof Error ? cause.message : "Could not book this room."); }
    finally { setBookingBusy(false); }
  };

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const columns = [
    { key: "room", header: "Room Name", render: (item: RoomBooking) => <><span className="block font-medium">{item.room.name}</span><span className="text-xs text-zinc-500">{item.room.room_code}</span></> },
    { key: "date", header: "Date", render: (item: RoomBooking) => new Date(`${item.booking_date}T00:00:00`).toLocaleDateString("en-GB") },
    { key: "time", header: "Time", render: (item: RoomBooking) => `${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}` },
    { key: "reason", header: "Reason", render: (item: RoomBooking) => reasonLabel(item.reason, item.reason_detail) },
    { key: "detail", header: "Detail", className: "max-w-xs truncate", render: (item: RoomBooking) => item.detail_booking },
    { key: "status", header: "Status", render: () => <Badge variant="success" showDot>Booked</Badge> },
  ] as const;

  return <AppShell title="Master Data | Booking Room">
    <div className="flex flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5 sm:flex-row sm:items-center">
        <div><h1 className="text-3xl font-medium text-gray-600">Booking Room</h1><p className="mt-1 text-sm text-zinc-600">Check a room’s availability and book a time slot.</p></div>
        <Button leftIcon={<CalendarDays size={18}/>} onClick={() => void openAvailability()}>Check Availability &amp; Book</Button>
      </section>
      <section className="rounded-3xl border border-rose-50 bg-white p-5">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Input label="Search Room Name" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Search room or booking detail" leftIcon={<Search size={18}/>} containerClassName="w-full sm:max-w-72" className="border-rose-600" />
          <Dropdown label="Reason" value={reasonFilter} onChange={(value) => { setPage(1); setReasonFilter(value); }} options={[{ value: "ALL", label: "All Reason" }, ...REASONS]} className="border-rose-600 sm:w-48" />
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? <p role="status" className="py-8 text-center text-zinc-500">Loading room bookings...</p> : <DataTable columns={columns} rows={items} getRowKey={(item) => item.id} emptyMessage="No room bookings found." caption="Room bookings" />}
        <div className="mt-4"><Pagination page={page} totalPages={Math.max(1, Math.ceil(total / 8))} pageSize={items.length} totalItems={total} onPageChange={setPage}/></div>
      </section>
    </div>
    <CheckRoomAvailabilityModal open={modalOpen} onClose={() => setModalOpen(false)} rooms={rooms} selectedDate={selectedDate} selectedRoomId={selectedRoomId} startTime={startTime} durationMinutes={durationMinutes} status={availabilityStatus} onDateChange={setSelectedDate} onRoomChange={setSelectedRoomId} onStartTimeChange={setStartTime} onDurationChange={setDurationMinutes} onSelectionChange={resetAvailability} onCheckAvailability={() => void checkAvailability()} onBookRoom={() => { setBookingError(""); setBookOpen(true); }} conflict={conflict} error={availabilityError}/>
    {bookOpen && selectedRoom && <BookRoomModal room={selectedRoom} date={selectedDate} startTime={startTime} durationMinutes={durationMinutes} reason={bookingReason} reasonDetail={reasonDetail} detailBooking={detailBooking} busy={bookingBusy} error={bookingError} onReasonChange={setBookingReason} onReasonDetailChange={setReasonDetail} onDetailBookingChange={setDetailBooking} onClose={() => setBookOpen(false)} onSubmit={() => void saveBooking()}/>}
  </AppShell>;
}
