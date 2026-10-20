"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, Building2, CalendarDays, ChevronDown, ExternalLink, Eye, FileText, Mail, Search, UserRound, Users, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/components/ui/toast";

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
  sla_overdue?: boolean;
  sla_due_at?: string | null;
  created_at: string;
  updated_at: string;
};
type Detail = {
  item: Item & { review_note?: string | null; training_title?: string | null; industry_name?: string | null; pic_email?: string | null };
  courses: Array<Record<string, unknown>>;
  attachments: Array<{ id: string; file_name: string; file_size: number; download_url: string }>;
};
type ApprovalOptions = {
  trainers: Array<{ id: string; name: string; email: string | null; status: string; rating: number }>;
  rooms: Array<{ id: string; room_code: string; name: string; capacity: number; facilities: string | null }>;
  roomRequired: boolean;
  sessions: string[];
};
type TrainingItem = {
  id: string; name: string; request_form_number: string; account_name: string; course_name: string;
  pic_name: string | null; trainer_name: string | null; room_name: string | null; training_type: string;
  expected_students: number | null; training_dates: string | null; status: string;
};

const formName = (item: Item) => item.form_type === "REGISTRATION" ? "Registration Form" : "Request Form";
const deliveryLabel = (value: unknown) => ({ PUBLIC: "Public", PRIVATE: "Private", INHOUSE: "In-house", ONLINE_PUBLIC: "Online Public", ONLINE_PRIVATE: "Online Private" } as Record<string, string>)[String(value)] ?? String(value ?? "-");
const statusLabel = (value: Item["status"]) => ({ DRAFT: "Draft", WAITING: "Waiting", REVISION: "Declined", APPROVED: "Approved" })[value];
const statusVariant = (value: Item["status"]) => value === "WAITING" ? "warning" as const : value === "APPROVED" ? "success" as const : value === "REVISION" ? "danger" as const : "neutral" as const;
function formatDates(values: string[]) {
  const sorted = [...new Set(values.filter(Boolean))].sort();
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
  const [trainingTotal, setTrainingTotal] = useState(0);
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
      const query = new URLSearchParams({ page: String(page), pageSize: "8" });
      const result = await api<{ items: TrainingItem[]; total: number }>(`/api/v1/internal/request-form-review/trainings?${query}`);
      setTrainings(result.items);
      setTrainingTotal(result.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Training list");
    }
  }, [api, page]);

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
    setBusy(true);
    setDialogError("");
    try {
      await api(`/api/v1/internal/request-form-review/${detail.item.id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ trainerId, roomId: approvalOptions.roomRequired ? roomId : null, baseFee: Number(baseFee), startTime, endTime }),
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
          <div className="mb-5"><h1 className="text-3xl font-medium text-gray-600">All Training List</h1><p className="mt-1 text-sm text-zinc-950/60">Scheduled and active training created from approved Request Forms.</p></div>
          {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="rounded-xl bg-neutral-100 text-xs text-gray-600"><tr>{["TRAINING", "REQUEST FORM #", "ACCOUNT", "COURSE", "TYPE", "STUDENTS", "TRAINER", "ROOM", "DATES", "STATUS"].map((label) => <th className="px-3 py-3 font-medium" key={label}>{label}</th>)}</tr></thead>
            <tbody>{trainings.map((training) => <tr key={training.id} className="border-b border-rose-50 text-gray-600"><td className="px-3 py-3 font-medium">{training.name}</td><td className="whitespace-nowrap px-3 py-3">{training.request_form_number}</td><td className="px-3 py-3">{training.account_name}</td><td className="px-3 py-3">{training.course_name}</td><td className="px-3 py-3">{deliveryLabel(training.training_type)}</td><td className="px-3 py-3">{training.expected_students ?? "-"}</td><td className="px-3 py-3">{training.trainer_name ?? "-"}</td><td className="px-3 py-3">{training.room_name ?? "-"}</td><td className="px-3 py-3">{formatDates(datesFromItem({ requested_dates: training.training_dates } as Item))}</td><td className="px-3 py-3"><Badge variant={training.status === "SCHEDULED" ? "success" : "neutral"} showDot>{training.status}</Badge></td></tr>)}{!trainings.length && <tr><td className="p-8 text-center text-gray-500" colSpan={10}>No training found.</td></tr>}</tbody>
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
              <td className="whitespace-nowrap px-3 py-3 font-medium">{item.request_form_number}</td><td className="px-3 py-3">{item.quotation_code ?? "-"}</td><td className="px-3 py-3">{item.account_name}</td><td className="px-3 py-3">{item.requested_course ?? "-"}</td><td className="whitespace-nowrap px-3 py-3"><span className="font-medium">{formName(item)}</span><span className="ml-1 text-xs text-zinc-500">({deliveryLabel(item.delivery_type)})</span></td><td className="px-3 py-3">{item.students ?? "-"}</td><td className="px-3 py-3">{formatDates(datesFromItem(item))}</td><td className="px-3 py-3"><div className="flex flex-col items-start gap-1"><Badge variant={statusVariant(item.status)} showDot>{statusLabel(item.status)}</Badge>{item.sla_overdue && <span className="rounded-full border border-red-500 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">SLA overdue</span>}</div></td>
              <td className="px-3 py-3"><div className="flex items-center gap-2"><button aria-label={`View ${formName(item)} details`} className="rounded-full p-2 text-zinc-600 hover:bg-neutral-100" onClick={() => void open(item.id)}><Eye size={16} /></button>{item.status === "WAITING" && <Button size="sm" onClick={() => void open(item.id)}>Approval</Button>}</div></td>
            </tr>)}{!items.length && <tr><td className="p-8 text-center text-gray-500" colSpan={9}>No requested training found.</td></tr>}</tbody>
          </table>
        </div>}
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / 8))} pageSize={items.length} totalItems={total} onPageChange={setPage} />
        </>}
      </section>
    </div>

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
