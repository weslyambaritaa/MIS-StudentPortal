"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, Building2, CalendarDays, ChevronDown, ExternalLink, Eye, FileText, Mail, Search, UserRound, Users, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { Modal } from "@mis/ui/modal";
import { Pagination } from "@mis/ui/pagination";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@mis/ui/toast";
import { normalizeCalendarDates } from "@/lib/normalize-calendar-dates";

type Item = {
  id: string;
  request_form_number: string;
  training_id?: string | null;
  form_type?: "REQUEST" | "REGISTRATION";
  status: "DRAFT" | "WAITING" | "REVISION" | "APPROVED";
  account_id: string;
  account_name: string;
  pic_name: string;
  quotation_code: string | null;
  po_reference: string | null;
  course_count: number;
  requested_course: string | null;
  delivery_type: string | null;
  students: number | null;
  requested_dates: string | null;
  created_at: string;
  updated_at: string;
};
type Detail = {
  item: Item & { review_note?: string | null; training_title?: string | null; industry_name?: string | null; pic_email?: string | null };
  courses: Array<Record<string, unknown>>;
  attachments: Array<{ id: string; file_name: string; file_size: number; download_url: string }>;
};
type ApprovalOptions = {
  trainers: Array<{ id: string; name: string; email: string | null; status: string; rating: number; booking_conflicts: Array<{ id: string; date: string; reason: string; detail_booking: string }> }>;
  rooms: Array<{ id: string; room_code: string; name: string; capacity: number; facilities: string | null }>;
  roomRequired: boolean;
  sessions: string[];
};
type TrainingItem = {
  id: string; name: string; request_form_number: string; account_name: string; course_name: string;
  pic_name: string | null; trainer_name: string | null; room_name: string | null; training_type: string;
  expected_students: number | null; training_dates: string | null; session_count?: number; status: string;
};
type TrainingDetail = { training: TrainingItem & { request_form_id: string; course_id: string; base_fee: number | string | null; room_capacity: number | null; industry_name: string | null; pic_email: string | null }; form: Detail; sessions: Array<{ id: string; session_number: number; starts_at: string; ends_at: string; class_location: string | null }> };
type Participant = { id: string; student_id: string | null; student_subject: string | null; name: string; email: string | null; company_role: string | null; account_name: string | null };
type StudentOption = { id: string; name: string; email: string; company_role: string | null; account_name: string };

const formName = (item: Item) => item.form_type === "REGISTRATION" ? "Registration Form" : "Request Form";
const deliveryLabel = (value: unknown) => ({ PUBLIC: "Public", PRIVATE: "Private", INHOUSE: "In-house", ONLINE_PUBLIC: "Online Public", ONLINE_PRIVATE: "Online Private" } as Record<string, string>)[String(value)] ?? String(value ?? "-");
const statusLabel = (value: Item["status"]) => ({ DRAFT: "Draft", WAITING: "Waiting", REVISION: "Declined", APPROVED: "Approved" })[value];
const statusVariant = (value: Item["status"]) => value === "WAITING" ? "warning" as const : value === "APPROVED" ? "success" as const : value === "REVISION" ? "danger" as const : "neutral" as const;
function formatDates(values: string[]) {
  const sorted = normalizeCalendarDates(values);
  if (!sorted.length) return "-";
  const grouped = new Map<string, number[]>();
  for (const value of sorted) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    grouped.set(key, [...(grouped.get(key) ?? []), day]);
  }
  const years = new Set([...grouped.keys()].map((key) => key.slice(0, 4)));
  return `${[...grouped.entries()].map(([key, days]) => {
    const [year, month] = key.split("-").map(Number);
    const ranges: string[] = [];
    for (let index = 0; index < days.length;) {
      let end = index;
      while (end + 1 < days.length && days[end + 1] === days[end] + 1) end += 1;
      ranges.push(end > index ? `${days[index]}–${days[end]}` : String(days[index]));
      index = end + 1;
    }
    const monthName = new Intl.DateTimeFormat("id-ID", { month: "short" }).format(new Date(year, month - 1, 1));
    return `${ranges.join(", ")} ${monthName}${years.size > 1 ? ` ${year}` : ""}`;
  }).join(", ")}${years.size === 1 ? ` ${[...years][0]}` : ""}`;
}
const datesFromItem = (item: Item) => item.requested_dates ? item.requested_dates.split(",") : [];
const dateRange = (course: Record<string, unknown>) => formatDates(((course.sessions as Array<Record<string, string>> | undefined) ?? []).map((session) => String(session.date).slice(0, 10)));

export default function RequestFormReviewPage() {
  const api = useApi();
  const { showToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [trainings, setTrainings] = useState<TrainingItem[]>([]);
  const [trainingDetail, setTrainingDetail] = useState<TrainingDetail | null>(null);
  const [trainingDetailTab, setTrainingDetailTab] = useState<"FORM" | "PARTICIPANT">("FORM");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [participantOptions, setParticipantOptions] = useState<StudentOption[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantDropdownOpen, setParticipantDropdownOpen] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [participantError, setParticipantError] = useState("");
  const [participantBusy, setParticipantBusy] = useState(false);
  const [trainingTotal, setTrainingTotal] = useState(0);
  const [trainingSearch, setTrainingSearch] = useState("");
  const [trainingStatus, setTrainingStatus] = useState("ALL");
  const [trainingSessionDate, setTrainingSessionDate] = useState("");
  const [activeTab, setActiveTab] = useState<"TRAININGS" | "REQUESTED">("REQUESTED");
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("WAITING");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [approvalOptions, setApprovalOptions] = useState<ApprovalOptions | null>(null);
  const [trainerId, setTrainerId] = useState("");
  const [trainerSearch, setTrainerSearch] = useState("");
  const [trainerDropdownOpen, setTrainerDropdownOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [baseFee, setBaseFee] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "8", status: statusFilter, accountId: accountFilter, search });
      const result = await api<{ items: Item[]; accounts: Array<{ id: string; name: string }>; total: number }>(`/api/v1/internal/request-form-review?${query}`);
      setItems(result.items);
      setAccounts(result.accounts);
      setTotal(result.total);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load requested training");
    } finally {
      setLoading(false);
    }
  }, [api, page, statusFilter, accountFilter, search]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const loadTrainings = useCallback(async () => {
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "8", search: trainingSearch, status: trainingStatus, sessionDate: trainingSessionDate });
      const result = await api<{ items: TrainingItem[]; total: number }>(`/api/v1/internal/request-form-review/trainings?${query}`);
      setTrainings(result.items);
      setTrainingTotal(result.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Training list");
    }
  }, [api, page, trainingSearch, trainingStatus, trainingSessionDate]);

  async function openTraining(id: string) {
    setError("");
    setTrainingDetailTab("FORM");
    try {
      const [nextDetail, participantResult] = await Promise.all([
        api<TrainingDetail>(`/api/v1/internal/request-form-review/trainings/${id}/detail`),
        api<{ items: Participant[] }>(`/api/v1/internal/request-form-review/trainings/${id}/participants`),
      ]);
      setTrainingDetail(nextDetail);
      setParticipants(participantResult.items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load Training details"); }
  }

  async function beginManageParticipants() {
    if (!trainingDetail) return;
    setParticipantBusy(true); setParticipantError("");
    try {
      setParticipantIds(participants.map((participant) => participant.student_id).filter((id): id is string => Boolean(id)));
      setParticipantOptions(participants.filter((person) => person.student_id).map((person) => ({ id: person.student_id!, name: person.name, email: person.email ?? "", company_role: person.company_role, account_name: person.account_name ?? "" })));
      setParticipantSearch(""); setParticipantDropdownOpen(false); setParticipantModalOpen(true);
    } catch (cause) { setParticipantError(cause instanceof Error ? cause.message : "Could not load Students"); }
    finally { setParticipantBusy(false); }
  }

  useEffect(() => {
    if (!participantModalOpen || !trainingDetail) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({ search: participantSearch.trim() });
      void api<{ items: StudentOption[] }>(`/api/v1/internal/request-form-review/trainings/${trainingDetail.training.id}/student-options?${query}`).then((result) => {
        if (!cancelled) setParticipantOptions((current) => [...new Map([...current, ...result.items].map((student) => [student.id, student])).values()]);
      }).catch((cause) => { if (!cancelled) setParticipantError(cause instanceof Error ? cause.message : "Could not search Students"); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [api, participantModalOpen, participantSearch, trainingDetail]);

  async function saveParticipants() {
    if (!trainingDetail) return;
    setParticipantBusy(true); setParticipantError("");
    try {
      const result = await api<{ items: Participant[] }>(`/api/v1/internal/request-form-review/trainings/${trainingDetail.training.id}/participants`, { method: "PUT", body: JSON.stringify({ studentIds: participantIds }) });
      setParticipants(result.items); setParticipantModalOpen(false); showToast("Training participants saved successfully.");
    } catch (cause) { setParticipantError(cause instanceof Error ? cause.message : "Could not save participants"); }
    finally { setParticipantBusy(false); }
  }

  useEffect(() => { if (activeTab === "TRAININGS") void loadTrainings(); }, [activeTab, loadTrainings]);

  async function open(id: string) {
    try {
      setDialogError("");
      setDetail(await api<Detail>(`/api/v1/internal/request-form-review/${id}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load request details");
    }
  }

  async function beginApproval() {
    if (!detail) return;
    setBusy(true);
    setDialogError("");
    try {
      const options = await api<ApprovalOptions>(`/api/v1/internal/request-form-review/${detail.item.id}/approval-options`);
      setApprovalOptions(options);
      setTrainerId("");
      setTrainerSearch("");
      setTrainerDropdownOpen(false);
      setRoomId("");
      setBaseFee("");
      setStartTime("");
      setEndTime("");
      setApprovalOpen(true);
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : "Could not load approval options");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!detail || !approvalOptions || !trainerId || !baseFee || !startTime || !endTime || endTime <= startTime || (approvalOptions.roomRequired && !roomId)) return;
    const trainerBookingConflicts = approvalOptions.trainers.find((trainer) => trainer.id === trainerId)?.booking_conflicts ?? [];
    if (trainerBookingConflicts.length) {
      const conflictDates = trainerBookingConflicts.map((booking) => booking.date).join(", ");
      const shouldReplace = window.confirm(`This Trainer already has a standalone booking on ${conflictDates}. If you continue, the Request Form Training will replace that booking. Continue?`);
      if (!shouldReplace) return;
    }
    setBusy(true);
    setDialogError("");
    try {
      await api(`/api/v1/internal/request-form-review/${detail.item.id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ trainerId, replaceTrainerBookingIds: trainerBookingConflicts.map((booking) => booking.id), roomId: approvalOptions.roomRequired ? roomId : null, baseFee: Number(baseFee), startTime, endTime }),
      });
      showToast(`${formName(detail.item)} approved and scheduled successfully.`);
      setApprovalOpen(false);
      setDetail(null);
      await load();
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : "Could not approve Request Form");
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!detail || !note.trim()) return;
    setBusy(true);
    setDialogError("");
    try {
      await api(`/api/v1/internal/request-form-review/${detail.item.id}/return`, { method: "PATCH", body: JSON.stringify({ note }) });
      showToast(`${formName(detail.item)} returned for revision successfully.`);
      setDeclineOpen(false);
      setDetail(null);
      setNote("");
      await load();
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : "Could not return Request Form");
    } finally {
      setBusy(false);
    }
  }

  const searchField = "h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-rose-100";
  const course = detail?.courses[0];
  const filteredTrainers = (approvalOptions?.trainers ?? []).filter((trainer) => trainer.name.toLowerCase().includes(trainerSearch.trim().toLowerCase()));
  const selectedTrainerBookingConflicts = approvalOptions?.trainers.find((trainer) => trainer.id === trainerId)?.booking_conflicts ?? [];
  const detailRow = (label: string, value: string, icon: ReactNode) => <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-start gap-3 text-sm"><div className="flex items-start gap-2 text-zinc-950/60"><span className="mt-0.5 shrink-0">{icon}</span><span>{label}</span></div><span className="break-words font-medium text-gray-600">{value}</span></div>;
  const choice = (label: string, selected: boolean) => <span key={label} className="inline-flex items-center gap-2 text-sm text-zinc-950/60"><span className={`relative size-3 shrink-0 rounded-full border ${selected ? "border-rose-600" : "border-zinc-400"}`}>{selected && <span className="absolute inset-[3px] rounded-full bg-rose-600" />}</span>{label}</span>;

  return <AppShell title="Training | List Training">
    <div className="space-y-6">
      <section className="rounded-3xl border border-rose-50 bg-white p-5">
        <div className="mb-6 flex w-fit gap-1 rounded-full border border-rose-600 bg-neutral-50 p-1" role="tablist" aria-label="Training views">
          <button type="button" role="tab" aria-selected={activeTab === "TRAININGS"} onClick={() => { setPage(1); setError(""); setActiveTab("TRAININGS"); }} className={`rounded-full px-3 py-2 text-xs font-medium ${activeTab === "TRAININGS" ? "bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white" : "text-rose-600 hover:bg-rose-50"}`}>All Training List</button>
          <button type="button" role="tab" aria-selected={activeTab === "REQUESTED"} onClick={() => { setPage(1); setError(""); setActiveTab("REQUESTED"); }} className={`rounded-full px-3 py-2 text-xs font-medium ${activeTab === "REQUESTED" ? "bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white" : "text-rose-600 hover:bg-rose-50"}`}>Requested Training</button>
        </div>
        {activeTab === "TRAININGS" ? <>
          <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><h1 className="text-3xl font-medium text-gray-600">Training List</h1><p className="mt-1 text-sm text-zinc-950/60">All approved training will be shown here.</p></div><div className="grid gap-3 sm:grid-cols-3"><label className="block text-sm text-gray-600">Search Training / RF Code<span className="mt-1 flex h-9 items-center gap-2 rounded-full border border-rose-600 bg-neutral-50 px-3"><Search size={16} className="text-slate-900/40"/><input value={trainingSearch} onChange={(event) => { setPage(1); setTrainingSearch(event.target.value); }} placeholder="Example: RF-2026-0001" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-900/40"/></span></label><label className="block text-sm text-gray-600">Training Sessions<span className="relative mt-1 block"><input aria-label="Filter by training session date" type="date" value={trainingSessionDate} onChange={(event) => { setPage(1); setTrainingSessionDate(event.target.value); }} className={searchField}/></span></label><label className="block text-sm text-gray-600">Status<span className="relative mt-1 block"><select className={`${searchField} appearance-none pr-9`} value={trainingStatus} onChange={(event) => { setPage(1); setTrainingStatus(event.target.value); }}><option value="ALL">All Status</option><option value="SCHEDULED">Scheduled</option><option value="ONGOING">Running</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600"/></span></label></div></div>
          {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="rounded-xl bg-neutral-100 text-xs text-gray-600"><tr>{["CODE", "COURSE & TRAINER", "TYPE", "DATE SESSION", "ROOM", "STATUS", "ACTION"].map((label) => <th className="px-3 py-3 font-medium" key={label}>{label}</th>)}</tr></thead>
            <tbody>{trainings.map((training) => <tr key={training.id} className="border-b border-rose-50 text-gray-600"><td className="whitespace-nowrap px-3 py-3 font-medium">{training.request_form_number}</td><td className="px-3 py-3"><span className="block font-medium text-rose-600">{training.trainer_name ?? "Trainer not assigned"}</span><span className="block text-xs text-zinc-600">{training.course_name}</span><span className="mt-1 block text-xs text-zinc-500">{training.expected_students ?? "-"} Participant{training.expected_students === 1 ? "" : "s"}</span></td><td className="px-3 py-3">{deliveryLabel(training.training_type)}</td><td className="px-3 py-3"><span className="block">{formatDates(datesFromItem({ requested_dates: training.training_dates } as Item))}</span><span className="text-xs text-zinc-500">{Number(training.session_count ?? 0)} Sessions</span></td><td className="px-3 py-3">{training.room_name ?? "-"}</td><td className="px-3 py-3"><Badge variant={training.status === "SCHEDULED" ? "success" : training.status === "ONGOING" ? "warning" : "neutral"} showDot>{training.status === "ONGOING" ? "Running" : training.status}</Badge></td><td className="px-3 py-3"><button aria-label={`View ${training.name}`} className="rounded-full p-2 text-zinc-600" onClick={() => void openTraining(training.id)}><Eye size={17}/></button></td></tr>)}{!trainings.length && <tr><td className="p-8 text-center text-gray-500" colSpan={7}>No training found.</td></tr>}</tbody>
          </table></div>
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(trainingTotal / 8))} pageSize={trainings.length} totalItems={trainingTotal} onPageChange={setPage} />
        </> : <>
        <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h1 className="text-3xl font-medium text-gray-600">Requested Training</h1>
            <p className="mt-1 text-sm text-zinc-950/60">All requested training from Sales is shown here.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm text-gray-600">Search Requested Course
              <span className="mt-1 flex h-9 items-center gap-2 rounded-full border border-rose-600 bg-neutral-50 px-3"><Search size={16} className="text-slate-900/40" /><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Example: Data Analytics" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-900/40" /></span>
            </label>
            <label className="block text-sm text-gray-600">Company
              <span className="relative mt-1 block"><select className={`${searchField} appearance-none pr-9`} value={accountFilter} onChange={(event) => { setPage(1); setAccountFilter(event.target.value); }}><option value="ALL">All Company</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600" /></span>
            </label>
            <label className="block text-sm text-gray-600">Status
              <span className="relative mt-1 block"><select className={`${searchField} appearance-none pr-9`} value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}><option value="ALL">All Status</option><option value="WAITING">Waiting</option><option value="REVISION">Declined</option><option value="APPROVED">Approved</option></select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600" /></span>
            </label>
          </div>
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        {loading ? <div className="py-10 text-center text-zinc-500">Loading requested training…</div> : <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="rounded-xl bg-neutral-100 text-xs text-gray-600"><tr>{["REQUEST FORM #", "QUOTATION", "ACCOUNT", "Requested Course", "FORM TYPE", "STUDENTS", "Requested Date", "STATUS", "ACTION"].map((label) => <th className="px-3 py-3 font-medium" key={label}>{label}</th>)}</tr></thead>
            <tbody>{items.map((item) => <tr className="border-b border-rose-50 text-gray-600" key={item.id}>
              <td className="whitespace-nowrap px-3 py-3 font-medium">{item.request_form_number}</td><td className="px-3 py-3">{item.quotation_code ?? "-"}</td><td className="px-3 py-3">{item.account_name}</td><td className="px-3 py-3">{item.requested_course ?? "-"}</td><td className="whitespace-nowrap px-3 py-3"><span className="font-medium">{formName(item)}</span><span className="ml-1 text-xs text-zinc-500">({deliveryLabel(item.delivery_type)})</span></td><td className="px-3 py-3">{item.students ?? "-"}</td><td className="px-3 py-3">{formatDates(datesFromItem(item))}</td><td className="px-3 py-3"><Badge variant={statusVariant(item.status)} showDot>{statusLabel(item.status)}</Badge></td>
              <td className="px-3 py-3"><div className="flex items-center gap-2"><button aria-label={`View ${formName(item)} details`} className="rounded-full p-2 text-zinc-600 hover:bg-neutral-100" onClick={() => void open(item.id)}><Eye size={16} /></button>{item.status === "WAITING" && <Button size="sm" onClick={() => void open(item.id)}>Approval</Button>}</div></td>
            </tr>)}{!items.length && <tr><td className="p-8 text-center text-gray-500" colSpan={9}>No requested training found.</td></tr>}</tbody>
          </table>
        </div>}
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / 8))} pageSize={items.length} totalItems={total} onPageChange={setPage} />
        </>}
      </section>
    </div>

    {trainingDetail && <>
      <button aria-label="Close Training details" className="fixed inset-0 z-40 cursor-default bg-black/25" onClick={() => setTrainingDetail(null)} />
      <aside aria-label="Training details" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-96 flex-col justify-between overflow-hidden border-l border-gray-200 bg-white p-6 shadow-2xl">
        <div className="flex min-h-0 flex-col gap-6">
          <div className="flex items-start gap-3"><button aria-label="Back to Training List" className="rounded-full p-2 text-gray-600 hover:bg-neutral-100" onClick={() => setTrainingDetail(null)}><X size={19}/></button><div><h2 className="text-2xl font-medium text-gray-600">Manage Training</h2><p className="mt-1 text-xs text-zinc-500">{trainingDetail.training.name}</p></div></div>
          <div className="flex rounded-full border border-rose-600 bg-neutral-50 p-1" role="tablist" aria-label="Training detail sections">
            <button role="tab" aria-selected={trainingDetailTab === "FORM"} onClick={() => setTrainingDetailTab("FORM")} className={`flex-1 rounded-full px-2 py-2 text-xs font-medium ${trainingDetailTab === "FORM" ? "bg-gradient-to-r from-red-400 to-rose-600 text-white" : "text-rose-600"}`}><FileText size={14} className="mr-1 inline"/>Form Details</button>
            <button role="tab" aria-selected={trainingDetailTab === "PARTICIPANT"} onClick={() => setTrainingDetailTab("PARTICIPANT")} className={`flex-1 rounded-full px-2 py-2 text-xs font-medium ${trainingDetailTab === "PARTICIPANT" ? "bg-gradient-to-r from-red-400 to-rose-600 text-white" : "text-rose-600"}`}><Users size={14} className="mr-1 inline"/>Participant</button>
          </div>
          <div className="min-h-0 space-y-6 overflow-y-auto pr-1">
            <section className="space-y-3">
              <h3 className="font-medium text-rose-600">Course Detail</h3>
              <div className="space-y-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">
                <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-orange-600 text-white"><BookOpen size={19}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-600">{trainingDetail.training.course_name}</p><p className="flex items-center gap-1 text-xs font-medium text-rose-600"><Users size={14}/>{trainingDetail.training.expected_students ?? 0} Students</p></div><Badge variant="neutral">Type: {deliveryLabel(trainingDetail.training.training_type)}</Badge></div>
                <div className="border-t border-zinc-950/20"/><p className="font-medium text-gray-600">Base Fee: <span className="text-rose-600">{trainingDetail.training.base_fee == null ? "-" : `Rp ${Number(trainingDetail.training.base_fee).toLocaleString("id-ID")}`}</span></p>
              </div>
            </section>
            {trainingDetailTab === "FORM" ? <>
              <section className="space-y-3"><h3 className="font-medium text-rose-600">Training Account</h3><div className="rounded-xl border border-rose-50 bg-neutral-50 p-3"><div className="flex items-center gap-3"><Building2 size={19} className="text-rose-600"/><div><p className="font-medium text-gray-600">{trainingDetail.training.account_name}</p><p className="text-sm text-zinc-950/60">{trainingDetail.training.industry_name ?? "-"}</p></div></div><div className="mt-3 space-y-1 border-t border-rose-100 pt-3 text-sm text-zinc-600"><p>PIC: <span className="font-medium text-gray-700">{trainingDetail.training.pic_name ?? "-"}</span></p><p className="break-all">PIC Email: <span className="font-medium text-gray-700">{trainingDetail.training.pic_email ?? "-"}</span></p><p>Trainer: <span className="font-medium text-gray-700">{trainingDetail.training.trainer_name ?? "-"}</span></p></div></div></section>
              <section className="space-y-3"><h3 className="font-medium text-rose-600">Room</h3><div className="rounded-xl border border-rose-50 bg-neutral-50 p-3"><div className="flex items-center gap-3"><Building2 size={19} className="text-rose-600"/><div><p className="font-medium text-gray-600">{trainingDetail.training.room_name ?? "External / Online"}</p><p className="text-sm text-zinc-950/60">{trainingDetail.training.room_capacity ? `${trainingDetail.training.room_capacity} Capacity` : trainingDetail.training.training_type.includes("ONLINE") ? "Online training" : "Client location"}</p></div></div><p className="mt-3 border-t border-rose-100 pt-3 text-xs text-blue-600">{formatDates(datesFromItem({ requested_dates: trainingDetail.training.training_dates } as Item))}</p></div></section>
              <section className="space-y-3"><div className="flex items-center gap-2"><FileText size={18} className="text-zinc-600"/><h3 className="font-medium text-gray-600">Request Form</h3></div><div className="space-y-2">{trainingDetail.form.attachments.length ? trainingDetail.form.attachments.map((asset) => <a key={asset.id} href={asset.download_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-xl border border-rose-50 bg-neutral-50 p-3"><span className="min-w-0"><span className="block truncate text-sm font-medium text-gray-600">{asset.file_name}</span><span className="text-xs font-medium text-rose-600">{(asset.file_size / 1024 / 1024).toFixed(1)} MB</span></span><ExternalLink size={17} className="shrink-0 text-rose-600"/></a>) : <p className="text-sm text-zinc-500">No Request Form attachment</p>}
                <div className="rounded-xl border border-rose-50 bg-neutral-50 p-3"><p className="font-medium text-gray-600">{String(trainingDetail.form.courses[0]?.course_name ?? trainingDetail.training.course_name)}</p><p className="text-sm text-rose-600">{String(trainingDetail.form.courses[0]?.language ?? "-")}</p><p className="mt-2 text-xs text-zinc-600">Request Form: {trainingDetail.form.item.request_form_number}</p></div>
              </div></section>
              <section className="space-y-2"><h3 className="font-medium text-rose-600">Class Type</h3><div className="flex flex-wrap gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">{["STANDARD", "CUSTOMIZED", "CEO"].map((value) => choice(value === "CUSTOMIZED" ? "Customized" : value[0] + value.slice(1).toLowerCase(), String(trainingDetail.form.courses[0]?.service_type).toUpperCase() === value))}</div></section>
              <section className="space-y-2"><h3 className="font-medium text-rose-600">Room Rental</h3><div className="rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-600">{trainingDetail.form.courses[0]?.room_rental ? [trainingDetail.form.courses[0]?.room_pc === "WITH" ? "With PC" : "Without PC", ...(((trainingDetail.form.courses[0]?.room_services as string[] | undefined) ?? []))].join(" · ") : "Not specified"}</div></section>
              <section className="space-y-2"><h3 className="font-medium text-rose-600">Special Instructions</h3><div className="whitespace-pre-line rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-600">{String(trainingDetail.form.courses[0]?.special_instruction ?? "-")}</div></section>
            </> : <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-medium text-rose-600">All Participant ({participants.length})</h3><button className="text-xs font-medium text-rose-600 hover:underline" onClick={() => setTrainingDetailTab("FORM")}>Form Details</button></div><div className="space-y-3">{participants.length ? participants.map((person, index) => <div key={person.id}><div className="flex items-center gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${["from-red-400 to-orange-600", "from-purple-400 to-fuchsia-600", "from-green-400 to-green-600", "from-indigo-400 to-indigo-700", "from-cyan-300 to-sky-500"][index % 5]} text-sm font-medium text-white`}>{person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-600">{person.name}</p><p className="truncate text-sm text-zinc-950/60">{person.email ?? "Email unavailable"}</p></div></div>{index < participants.length - 1 && <div className="mt-3 border-t border-rose-50"/>}</div>) : <p className="rounded-xl bg-neutral-50 p-4 text-center text-sm text-zinc-500">No participants added yet.</p>}</div></section>}
          </div>
        </div>
        <div className="pt-4"><Button className="w-full" leftIcon={<Users size={18}/>} disabled={participantBusy} onClick={() => void beginManageParticipants()}>{participantBusy ? "Loading Students…" : "Manage Participant"}</Button></div>
      </aside>
    </>}

    {participantModalOpen && trainingDetail && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => !participantBusy && setParticipantModalOpen(false)}>
      <div className="flex max-h-[92vh] w-full max-w-[902px] flex-col gap-6 overflow-hidden rounded-3xl border border-rose-50 bg-white p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between"><h2 className="text-2xl font-medium text-gray-600">Manage Participant</h2><button aria-label="Close" className="rounded-full p-2 text-gray-600 hover:bg-neutral-100" onClick={() => !participantBusy && setParticipantModalOpen(false)}><X size={19}/></button></div>
        <div className="flex items-end gap-3"><label className="relative flex-1 text-sm text-gray-600">Participant From <span className="text-rose-600">Student Master Data</span><span className="relative mt-1 block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/><input autoComplete="off" value={participantSearch} onChange={(event) => setParticipantSearch(event.target.value)} placeholder="Search & Pick a Student" className="h-9 w-full rounded-full border border-rose-600 bg-neutral-50 pl-9 pr-3 outline-none focus:ring-2 focus:ring-rose-100"/>{participantDropdownOpen && <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-rose-100 bg-white p-1 shadow-lg">{participantOptions.filter((student) => !participantIds.includes(student.id) && (!participantSearch.trim() || `${student.name} ${student.email} ${student.account_name}`.toLowerCase().includes(participantSearch.toLowerCase()))).slice(0, 20).map((student) => <button key={student.id} type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-rose-50" onClick={() => { setParticipantIds((ids) => [...ids, student.id]); setParticipantSearch(""); }}><span className="block text-sm font-medium">{student.name}</span><span className="block text-xs text-zinc-500">{student.email} · {student.account_name}</span></button>)}{participantOptions.filter((student) => !participantIds.includes(student.id)).length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">No Students found.</p>}</div>}</span></label><button type="button" aria-label={participantDropdownOpen ? "Close Student options" : "Open Student options"} aria-expanded={participantDropdownOpen} onClick={() => setParticipantDropdownOpen((open) => !open)} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-red-400 to-rose-600 text-white"><Users size={18}/></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto"><p className="mb-2 text-sm text-gray-600">Student Preview</p><div className="grid grid-cols-[1fr_1fr_1.3fr_1fr_3rem] gap-2 rounded-xl bg-neutral-100 p-3 text-xs font-medium text-gray-600"><span>NAME</span><span>ACCOUNT NAME</span><span>EMAIL</span><span>ROLE</span><span>ACTION</span></div><div>{participantIds.map((id) => { const student = participantOptions.find((option) => option.id === id); if (!student) return null; return <div key={id} className="grid grid-cols-[1fr_1fr_1.3fr_1fr_3rem] items-center gap-2 border-b border-rose-50 p-3 text-xs text-zinc-700"><span className="break-words">{student.name}</span><span className="break-words">{student.account_name}</span><span className="break-all">{student.email}</span><span className="break-words">{student.company_role || "-"}</span><button aria-label={`Remove ${student.name}`} className="rounded-full bg-red-500/10 p-2 text-red-500 hover:bg-red-100" onClick={() => setParticipantIds((ids) => ids.filter((value) => value !== id))}><X size={15}/></button></div>})}</div></div>
        {participantError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{participantError}</p>}
        <div className="flex justify-end gap-3 border-t border-zinc-200 pt-4"><Button variant="ghost" disabled={participantBusy} onClick={() => setParticipantModalOpen(false)}>Cancel</Button><Button disabled={participantBusy} onClick={() => void saveParticipants()}>{participantBusy ? "Saving…" : "Save Participant"}</Button></div>
      </div>
    </div>}

    {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setDetail(null)}>
      <div className="max-h-[92vh] w-full max-w-[902px] overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between"><h2 className="text-2xl font-medium text-gray-600">{formName(detail.item)} Details</h2><button aria-label="Close" className="rounded-full p-2 text-gray-600 hover:bg-neutral-100" onClick={() => setDetail(null)}><X size={19} /></button></div>
        <div className="mb-4 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-gray-600">Request Form #: <span className="font-medium">{detail.item.request_form_number}</span>{detail.item.training_id && <> <span className="mx-2 text-zinc-400">·</span> Training ID: <span className="font-medium">{detail.item.training_id}</span></>}</div>
        {detail.item.review_note && <p className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">Revision note: {detail.item.review_note}</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-6 rounded-3xl border border-gray-200 p-4">
            <div className="flex items-center gap-2"><Building2 size={19} className="text-gray-600"/><h3 className="font-medium text-slate-900">Account Details</h3></div>
            <div className="space-y-4 rounded-xl border border-rose-50 bg-neutral-50 p-3">
              <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-orange-600 text-white"><Building2 size={19}/></span><div className="min-w-0"><p className="truncate font-medium text-gray-600">{detail.item.account_name}</p><p className="truncate text-sm font-medium text-zinc-950/60">{detail.item.industry_name ?? "-"}</p></div></div>
              <div className="border-t border-zinc-950/20" />
              <div className="space-y-3">
                {detailRow("PIC", detail.item.pic_name, <UserRound size={17}/>)}
                {detailRow("PIC Email", detail.item.pic_email ?? "-", <Mail size={17}/>)}
                {detailRow("Course", detail.courses.map((item) => String(item.course_name)).join(", ") || "-", <FileText size={17}/>)}
                {detailRow("Course Type", deliveryLabel(course?.delivery_type), <Building2 size={17}/>)}
                {detailRow("Amount Student", String(course?.amount_student ?? "-"), <UserRound size={17}/>)}
              </div>
            </div>
          </section>
          <section className="space-y-5 overflow-hidden rounded-3xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><FileText size={19} className="text-zinc-950/60"/><h3 className="font-medium text-slate-900">{formName(detail.item)}</h3></div><Badge variant={statusVariant(detail.item.status)} showDot>{statusLabel(detail.item.status)}</Badge></div>
            <div className="space-y-2"><h4 className="text-sm text-gray-600">{detail.item.form_type === "REGISTRATION" ? "Registration Attachment" : "RF Attachment"}</h4>{detail.attachments.length ? <div className="space-y-2">{detail.attachments.map((attachment) => <a key={attachment.id} href={attachment.download_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3"><span className="flex min-w-0 items-center gap-3"><FileText size={20} className="shrink-0 text-zinc-950/60"/><span className="min-w-0"><span className="block truncate font-medium text-gray-600">{attachment.file_name}</span><small className="block font-medium text-rose-600">{(attachment.file_size / 1024 / 1024).toFixed(1)} MB</small></span></span><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white"><ExternalLink size={18}/></span></a>)}</div> : <p className="text-sm text-zinc-500">No attachment uploaded</p>}</div>
            <div className="space-y-3"><h4 className="font-medium text-rose-600">Detail Course</h4>{detail.courses.map((requestedCourse) => <article key={String(requestedCourse.id)} className="rounded-xl border border-rose-50 bg-neutral-50 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium text-gray-600">{String(requestedCourse.course_name)}</p><p className="text-sm font-medium text-rose-600">{String(requestedCourse.language)}</p></div><span className="shrink-0 text-right text-xs font-medium text-zinc-950/60">{dateRange(requestedCourse)}</span></div></article>)}</div>
            {detail.courses.map((requestedCourse) => <div key={`service-${String(requestedCourse.id)}`} className="space-y-3">
              <div className="space-y-2"><h4 className="font-medium text-rose-600">Class Type</h4><div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-rose-50 bg-neutral-50 p-3">{["STANDARD", "CUSTOMIZED", "CEO"].map((value) => choice(value === "CUSTOMIZED" ? "Customized" : value[0] + value.slice(1).toLowerCase(), String(requestedCourse.service_type).toUpperCase() === value))}</div></div>
              <div className="space-y-2"><h4 className="font-medium text-rose-600">Room Rental</h4><div className="space-y-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">{requestedCourse.room_rental === null ? <p className="text-sm text-zinc-500">Not specified</p> : requestedCourse.room_rental ? <><div className="flex flex-wrap gap-x-5 gap-y-2">{choice("With PC", requestedCourse.room_pc === "WITH")}{choice("Without PC", requestedCourse.room_pc === "WITHOUT")}</div><div className="flex flex-wrap gap-x-5 gap-y-2">{([ ["INTERNET", "With Internet Connection"], ["LAN", "With LAN"], ["SNACKS", "Snacks"], ["LUNCH", "Lunch"] ] as const).map(([value, label]) => choice(label, ((requestedCourse.room_services as string[] | undefined) ?? []).includes(value)))}</div></> : <p className="text-sm text-zinc-500">No room rental</p>}</div></div>
              <div className="space-y-2"><h4 className="font-medium text-rose-600">Special Instructions</h4><div className="min-h-12 rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-950/60">{requestedCourse.special_instruction ? <span className="whitespace-pre-line">{String(requestedCourse.special_instruction)}</span> : "-"}</div></div>
            </div>)}
          </section>
        </div>
        {dialogError && !approvalOpen && !declineOpen && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{dialogError}</p>}
        <div className="mt-6 flex justify-between border-t border-zinc-950/20 pt-5">{detail.item.status === "WAITING" ? <div className="flex gap-3"><Button variant="soft" disabled={busy} onClick={() => { setDialogError(""); setNote(""); setDeclineOpen(true); }}>Decline Request</Button><Button disabled={busy} onClick={() => void beginApproval()}>{busy ? "Loading…" : "Approve Request"}</Button></div> : <span />}<Button variant="ghost" onClick={() => setDetail(null)}>Close</Button></div>
      </div>
    </div>}

    {approvalOpen && detail && course && approvalOptions && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setApprovalOpen(false)}>
      <div className="max-h-[92vh] w-full max-w-md space-y-5 overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between"><h2 className="text-2xl font-medium text-gray-600">Approve Request</h2><button aria-label="Close" onClick={() => setApprovalOpen(false)} className="rounded-full p-2 hover:bg-neutral-100"><X size={18} /></button></div>
        <section className="space-y-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-orange-600 text-white"><BookOpen size={19}/></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-600">{String(course.course_name)}</p><p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-rose-600"><Users size={14}/>{String(course.amount_student)} Students</p></div>
            <Badge variant="neutral">Type: {deliveryLabel(course.delivery_type)}</Badge>
          </div>
          <div className="h-px bg-zinc-950/20" />
          <div className="flex items-start gap-2 text-sm"><CalendarDays size={18} className="shrink-0 text-zinc-950/60"/><p><span className="font-medium text-zinc-950/60">Date:</span><span className="font-medium text-gray-600"> {dateRange(course)}</span></p></div>
        </section>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-gray-600">Start Time *<input type="time" required className={`${searchField} mt-1`} value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          <label className="block text-sm text-gray-600">End Time *<input type="time" required className={`${searchField} mt-1`} value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        </div>
        <p className="-mt-3 text-xs text-zinc-950/60">This time range will be applied to every requested date.</p>
        {startTime && endTime && endTime <= startTime && <p className="text-sm text-red-600">End Time must be later than Start Time.</p>}
        <div className="block text-sm text-gray-600"><label htmlFor="approval-trainer-search">Course Trainer *</label>
          <span className="relative mt-1 block">
            <input id="approval-trainer-search" role="combobox" aria-expanded={trainerDropdownOpen} aria-controls="approval-trainer-options" aria-autocomplete="list" autoComplete="off" className={`${searchField} pr-9`} value={trainerSearch} placeholder="Pick a Trainer (& Status)" onFocus={() => setTrainerDropdownOpen(true)} onChange={(event) => { setTrainerSearch(event.target.value); setTrainerId(""); setTrainerDropdownOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setTrainerDropdownOpen(false); if (event.key === "ArrowDown") { event.preventDefault(); setTrainerDropdownOpen(true); document.getElementById("approval-trainer-options")?.querySelector<HTMLButtonElement>("button")?.focus(); } }} />
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600" />
            {trainerDropdownOpen && <div id="approval-trainer-options" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-rose-100 bg-white p-1 shadow-lg">
              {filteredTrainers.length ? filteredTrainers.map((trainer) => <button key={trainer.id} type="button" role="option" aria-selected={trainer.id === trainerId} className="w-full rounded-lg px-3 py-2 text-left hover:bg-rose-50 focus:bg-rose-50 focus:outline-none" onClick={() => { setTrainerId(trainer.id); setTrainerSearch(`${trainer.name} · ${trainer.status} · ★ ${Number(trainer.rating ?? 0).toFixed(1)}`); setTrainerDropdownOpen(false); }}><span className="block text-sm font-medium text-gray-700">{trainer.name}</span><span className="block text-xs text-zinc-500">{trainer.status} · ★ {Number(trainer.rating ?? 0).toFixed(1)}{trainer.email ? ` · ${trainer.email}` : ""}</span></button>) : <p className="px-3 py-2 text-sm text-zinc-500">No matching Trainers found.</p>}
            </div>}
          </span>
        </div>
        {selectedTrainerBookingConflicts.length > 0 && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">This Trainer has a standalone booking on {selectedTrainerBookingConflicts.map((booking) => booking.date).join(", ")}. You can continue, but approving this Request Form will replace that booking.</p>}
        {approvalOptions.roomRequired ? <label className="block text-sm text-gray-600">Pick a Room (For {String(course.amount_student)} Students) *
          <span className="relative mt-1 block"><select className={`${searchField} appearance-none pr-9`} value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">Pick a Room</option>{approvalOptions.rooms.map((room) => <option key={room.id} value={room.id}>{room.room_code} · {room.name} · Capacity {room.capacity}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600" /></span>
          {approvalOptions.rooms.length === 0 && <span className="mt-1 block text-xs text-red-600">No available room fits this class on all requested dates.</span>}
        </label> : <p className="rounded-xl bg-neutral-50 p-3 text-sm text-zinc-600">Room selection is not required for this location. The requested client address will be used.</p>}
        <label className="block text-sm text-gray-600">Base Fee *<input inputMode="decimal" className={`${searchField} mt-1`} value={baseFee ? Number(baseFee).toLocaleString("id-ID") : ""} onChange={(event) => setBaseFee(event.target.value.replace(/[^0-9]/g, ""))} placeholder="Rp 20.000.000" /></label>
        <div className="rounded-3xl border border-blue-400 bg-blue-500/10 p-3 text-sm text-slate-700"><p className="font-medium text-blue-600">Room Availability</p><p className="mt-1">Only rooms that fit the capacity and are not booked on any requested date are listed. Selected rooms are reserved for the full day.</p></div>
        {dialogError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{dialogError}</p>}
        <div className="flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setApprovalOpen(false)}>Cancel</Button><Button disabled={busy || !trainerId || !baseFee || !startTime || !endTime || endTime <= startTime || (approvalOptions.roomRequired && (!roomId || !approvalOptions.rooms.some((room) => room.id === roomId)))} onClick={() => void approve()}>{busy ? "Approving…" : "Approve Request"}</Button></div>
      </div>
    </div>}

    {declineOpen && detail && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setDeclineOpen(false)}>
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-rose-50 bg-white p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between"><h2 className="text-2xl font-medium text-gray-600">Decline Reason</h2><button aria-label="Close" onClick={() => setDeclineOpen(false)} className="rounded-full p-2 hover:bg-neutral-100"><X size={18} /></button></div>
        <label className="block text-sm text-gray-600">Give Decline Reason *<textarea className="mt-1 min-h-24 w-full rounded-xl border border-rose-600 bg-neutral-50 px-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-100" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Because…" maxLength={4000} /></label>
        {dialogError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{dialogError}</p>}
        <div className="flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setDeclineOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void decline()}>{busy ? "Saving…" : "Confirm Decline"}</Button></div>
      </div>
    </div>}
  </AppShell>;
}
