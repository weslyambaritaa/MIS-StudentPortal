"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Eye, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/hooks/use-api";
import { WithdrawConfirmation } from "./dialog/withdraw-confirmation";

type Account = { id: string; name: string };
type Pic = { id: string; name: string; email: string };
type Course = { id: string; name: string; duration_minutes: number };
type Quote = {
  id: string;
  quotation_code: string;
  class_type: "PUBLIC" | "PRIVATE" | "INHOUSE" | "ONLINE_PUBLIC" | "ONLINE_PRIVATE";
  account_name: string;
  pic_name: string;
};
type QuotePreview = {
  quote: { account_id: string; pic_profile_id: string; quotation_code: string; class_type: string; account_name: string; pic_name: string; pic_email: string };
  lines: Array<{
    course_id: string;
    amount_student: number;
    class_type: string;
    course_name: string;
  }>;
};
type Session = { date: string };
type DetailCourse = {
  courseId: string;
  amountStudent: number;
  deliveryType: string;
  serviceType: string;
  language: string;
  roomRental: boolean | null;
  roomPc: string | null;
  roomServices: string[];
  locationType: "INTERNAL" | "CLIENT" | "ONLINE";
  locationName: string;
  locationAddress: string;
  specialInstruction: string;
  sessions: Session[];
};
type Row = {
  id: string;
  request_form_number: string;
  training_id?: string | null;
  form_type?: "REQUEST" | "REGISTRATION";
  status: "DRAFT" | "WAITING" | "REVISION" | "APPROVED";
  account_name: string;
  pic_name: string;
  quotation_code: string | null;
  course_count: number;
  attachment_count: number;
  review_note: string | null;
  po_reference: string | null;
  requested_course: string | null;
  delivery_type: string | null;
  students: number | null;
  requested_dates: string | null;
};
type Details = {
  item: Row & { quotation_id: string | null; account_id: string; pic_profile_id: string; pic_email?: string; quotation_class_type?: string | null; training_title?: string | null };
  courses: Array<Record<string, unknown>>;
  attachments: Array<{ id: string; file_name: string; file_size: number; download_url: string }>;
};
const statusLabel = (status: Row["status"]) =>
  ({ DRAFT: "Draft", WAITING: "Waiting", REVISION: "Declined", APPROVED: "Approved" })[status];
const deliveryTypeLabel = (type: string) =>
  (({ INHOUSE: "In-house", ONLINE_PRIVATE: "Online Private", ONLINE_PUBLIC: "Online Public" }) as Record<string, string>)[type] ?? type;
function formatSessionDates(dates: string[]) {
  const sorted = [...new Set(dates.filter(Boolean))].sort();
  if (!sorted.length) return "-";
  const groups = new Map<string, number[]>();
  for (const value of sorted) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    groups.set(key, [...(groups.get(key) ?? []), day]);
  }
  const years = new Set([...groups.keys()].map((key) => key.slice(0, 4)));
  const formatted = [...groups.entries()].map(([key, days]) => {
    const [year, month] = key.split("-").map(Number);
    const chunks: string[] = [];
    for (let index = 0; index < days.length;) {
      let end = index;
      while (end + 1 < days.length && days[end + 1] === days[end] + 1) end += 1;
      chunks.push(end > index ? `${days[index]}–${days[end]}` : String(days[index]));
      index = end + 1;
    }
    const monthName = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(year, month - 1, 1));
    return `${chunks.join(", ")} ${monthName}${years.size > 1 ? ` ${year}` : ""}`;
  });
  return `${formatted.join(", ")}${years.size === 1 ? ` ${[...years][0]}` : ""}`;
}

function MultiDateCalendar({ dates, onChange }: { dates: string[]; onChange: (dates: string[]) => void }) {
  const [month, setMonth] = useState(() => {
    const first = dates[0] ? new Date(`${dates[0]}T00:00:00`) : new Date();
    return new Date(first.getFullYear(), first.getMonth(), 1);
  });
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const chosen = new Set(dates);
  const dateFor = (day: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  function toggleDate(value: string) {
    onChange(chosen.has(value) ? dates.filter((date) => date !== value) : [...dates, value].sort());
  }
  return <div className="space-y-3 rounded-xl border border-rose-600 bg-neutral-50 p-3">
    <div className="flex items-center justify-between">
      <button type="button" aria-label="Previous month" className="rounded-full p-2 text-rose-600 hover:bg-rose-50" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><ChevronLeft size={18} /></button>
      <span className="text-sm font-medium text-gray-600">{new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(month)}</span>
      <button type="button" aria-label="Next month" className="rounded-full p-2 text-rose-600 hover:bg-rose-50" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><ChevronRight size={18} /></button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-950/60">{["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => <span className="py-1" key={day}>{day}</span>)}
      {cells.map((day, index) => day === null ? <span aria-hidden="true" key={`empty-${index}`} /> : <button type="button" key={dateFor(day)} aria-label={new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date(year, monthIndex, day))} aria-pressed={chosen.has(dateFor(day))} onClick={() => toggleDate(dateFor(day))} className={`mx-auto flex size-9 items-center justify-center rounded-full text-sm ${chosen.has(dateFor(day)) ? "bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white" : "text-gray-600 hover:bg-rose-100"}`}>{day}</button>)}
    </div>
    <p className="border-t border-rose-100 pt-2 text-xs text-zinc-950/60">{dates.length ? formatSessionDates(dates) : "Pilih satu atau beberapa tanggal"}</p>
  </div>;
}
const emptyCourse = (): DetailCourse => ({
  courseId: "",
  amountStudent: 1,
  deliveryType: "PRIVATE",
  serviceType: "STANDARD",
  language: "Indonesia",
  roomRental: null,
  roomPc: null,
  roomServices: [],
  locationType: "INTERNAL",
  locationName: "",
  locationAddress: "",
  specialInstruction: "",
  sessions: [],
});

export default function RequestFormPage({
  mode = "REQUEST",
}: {
  mode?: "REQUEST" | "REGISTRATION";
}) {
  const api = useApi();
  const { showToast } = useToast();
  const [items, setItems] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pics, setPics] = useState<Pic[]>([]);
  const [status, setStatus] = useState("ALL");
  const [deliveryType, setDeliveryType] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(false);
  const [selected, setSelected] = useState<Details | null>(null);
  const [withdrawConfirmationOpen, setWithdrawConfirmationOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [sourceTab, setSourceTab] = useState<"QUOTATION" | "MANUAL">("QUOTATION");
  const [quotationId, setQuotationId] = useState("");
  const [quotePreview, setQuotePreview] = useState<QuotePreview | null>(null);
  const [accountId, setAccountId] = useState("");
  const [picId, setPicId] = useState("");
  const [lines, setLines] = useState<DetailCourse[]>([emptyCourse()]);
  const [notes, setNotes] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const formName = mode === "REGISTRATION" ? "Registration Form" : "Request Form";
  const deliveryOptions: Array<[string, string]> = mode === "REGISTRATION"
    ? [["PUBLIC", "Public"], ["ONLINE_PUBLIC", "Online Public"]]
    : [["PRIVATE", "Private"], ["INHOUSE", "In-house"], ["ONLINE_PRIVATE", "Online Private"]];
  const trainingTitle = [...new Set(lines.map((line) => courses.find((course) => course.id === line.courseId)?.name).filter(Boolean))].join(" + ");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "8",
        status,
        deliveryType,
        accountId: accountFilter,
        search,
        formType: mode,
      });
      const [list, opts] = await Promise.all([
        api<{ items: Row[]; total: number }>(`/api/v1/internal/request-forms?${params}`),
        api<{ accounts: Account[]; courses: Course[]; quotations: Quote[] }>(
          `/api/v1/internal/request-forms/options?formType=${mode}`
        ),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setAccounts(opts.accounts);
      setCourses(opts.courses);
      setQuotes(opts.quotations);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not load ${formName}s`);
    } finally {
      setLoading(false);
    }
  }, [api, page, status, deliveryType, accountFilter, search, mode, formName]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!accountId || quotationId) {
      setPics([]);
      return;
    }
    void api<{ items: Pic[] }>(`/api/v1/internal/request-forms/accounts/${accountId}/pics`)
      .then((v) => setPics(v.items))
      .catch(() => setPics([]));
  }, [api, accountId, quotationId]);
  function openNew() {
    setEditingId("");
    setSourceTab("QUOTATION");
    setQuotationId("");
    setQuotePreview(null);
    setAccountId("");
    setPicId("");
    setNotes([]);
    setLines([{ ...emptyCourse(), deliveryType: mode === "REGISTRATION" ? "PUBLIC" : "PRIVATE" }]);
    setFiles([]);
    setError("");
    setEditor(true);
  }
  async function openEdit(id: string) {
    try {
      const value = await api<Details>(`/api/v1/internal/request-forms/${id}`);
      setEditingId(id);
      setSourceTab(value.item.quotation_id ? "QUOTATION" : "MANUAL");
      setQuotationId(value.item.quotation_id ?? "");
      if (value.item.quotation_id) {
        const preview = await api<QuotePreview>(`/api/v1/internal/request-forms/quotations/${value.item.quotation_id}/preview?formType=${mode}`);
        setQuotePreview(preview);
      } else {
        setQuotePreview(null);
      }
      setAccountId(value.item.account_id);
      setPicId(value.item.pic_profile_id);
      setNotes(
        String(value.courses[0]?.special_instruction ?? "")
          .split("\n")
          .filter(Boolean)
      );
      setLines(
        value.courses.slice(0, 1).map((c) => ({
          courseId: String(c.course_id),
          amountStudent: Number(c.amount_student),
          deliveryType: String(c.delivery_type),
          serviceType: String(c.service_type),
          language: String(c.language),
          roomRental: c.room_rental === null ? null : Boolean(c.room_rental),
          roomPc: c.room_pc ? String(c.room_pc) : null,
          roomServices: Array.isArray(c.room_services) ? (c.room_services as string[]) : [],
          locationType: c.location_type ? String(c.location_type) as DetailCourse["locationType"] : "INTERNAL",
          locationName: String(c.location_name ?? ""),
          locationAddress: String(c.location_address ?? ""),
          specialInstruction: String(c.special_instruction ?? ""),
          sessions: (c.sessions as Array<Record<string, string>>).map((s) => ({ date: String(s.date).slice(0, 10) })),
        }))
      );
      setFiles([]);
      setEditor(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open Request Form");
    }
  }
  function updateLine(index: number, change: Partial<DetailCourse>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...change } : line)));
  }
  function updateCourseDeliveryType(index: number, value: string) {
    const shouldClearRequestLocation = mode === "REQUEST" && value !== "INHOUSE";
    updateLine(index, {
      deliveryType: value,
      locationType: value.startsWith("ONLINE") ? "ONLINE" : value === "INHOUSE" ? "CLIENT" : shouldClearRequestLocation || lines[index].locationType === "ONLINE" ? "INTERNAL" : lines[index].locationType,
      locationName: value.startsWith("ONLINE") || shouldClearRequestLocation ? "" : lines[index].locationName,
      locationAddress: value.startsWith("ONLINE") || shouldClearRequestLocation ? "" : lines[index].locationAddress,
    });
  }
  function updateCourseFormat(index: number, format: "ONLINE" | "OFFLINE") {
    const currentType = lines[index]?.deliveryType ?? "";
    const isOnline = currentType.startsWith("ONLINE");
    if ((format === "ONLINE") === isOnline) return;
    const nextType = format === "ONLINE"
      ? mode === "REGISTRATION" ? "ONLINE_PUBLIC" : "ONLINE_PRIVATE"
      : mode === "REGISTRATION" ? "PUBLIC" : "PRIVATE";
    updateCourseDeliveryType(index, nextType);
  }
  function toggleQuotationCourse(courseId: string) {
    const isSelected = lines.some((line) => line.courseId === courseId);
    if (isSelected) {
      if (lines.length === 1) {
        setError("Select at least one Course for this form.");
        return;
      }
      setLines((current) => current.filter((line) => line.courseId !== courseId));
      setError("");
      return;
    }
    const quotationLine = quotePreview?.lines.find((line) => line.course_id === courseId);
    if (!quotationLine || !quotePreview) return;
    setLines([{
      ...emptyCourse(),
      courseId,
      amountStudent: Number(quotationLine.amount_student),
      deliveryType: quotePreview.quote.class_type,
      locationType: quotePreview.quote.class_type.startsWith("ONLINE") ? "ONLINE" : quotePreview.quote.class_type === "INHOUSE" ? "CLIENT" : "INTERNAL",
      locationName: "",
      locationAddress: "",
    }]);
    setError("");
  }
  async function uploadFiles(formId: string) {
    for (const file of files) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Cannot read ${file.name}`));
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.readAsDataURL(file);
      });
      await api(`/api/v1/internal/request-forms/${formId}/attachments`, {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, contentBase64: base64 }),
      });
    }
  }
  async function save(submit: boolean) {
    setBusy(true);
    setError("");
    const wasEditing = Boolean(editingId);
    const uploadedCount = files.length;
    try {
      const body = {
        formType: mode,
        quotationId: sourceTab === "QUOTATION" ? quotationId || null : null,
        accountId,
        picId,
        trainingTitle,
        courses: lines.map((line) => ({
          ...line,
          specialInstruction: notes.filter((note) => note.trim()).join("\n"),
        })),
      };
      const value = editingId
        ? await api<Details>(`/api/v1/internal/request-forms/${editingId}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await api<Details>("/api/v1/internal/request-forms", {
            method: "POST",
            body: JSON.stringify(body),
          });
      setEditingId(value.item.id);
      await uploadFiles(value.item.id);
      if (submit)
        await api(`/api/v1/internal/request-forms/${value.item.id}/submit`, {
          method: "POST",
          body: "{}",
        });
      if (uploadedCount > 0)
        showToast(`${uploadedCount} ${formName} attachment(s) uploaded successfully.`);
      showToast(submit
        ? `${formName} submitted to Admin successfully.`
        : wasEditing
          ? `${formName} draft updated successfully.`
          : `${formName} draft saved successfully.`);
      setEditor(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not save ${formName}`);
    } finally {
      setBusy(false);
    }
  }
  async function withdrawSelected() {
    if (!selected || selected.item.status !== "WAITING") return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/internal/request-forms/${selected.item.id}/withdraw`, {
        method: "POST",
        body: "{}",
      });
      showToast(`${formName} withdrawn to Draft successfully.`);
      setWithdrawConfirmationOpen(false);
      setSelected(null);
      await load();
    } catch (e) {
      setWithdrawConfirmationOpen(false);
      setSelected(null);
      setError(e instanceof Error ? e.message : "Could not withdraw Request Form");
    } finally {
      setBusy(false);
    }
  }
  async function showDetails(id: string) {
    try {
      setSelected(await api<Details>(`/api/v1/internal/request-forms/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load details");
    }
  }
  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    const allowed = /\.(pdf|doc|docx)$/i;
    const invalid = selectedFiles.find((file) => !allowed.test(file.name) || file.size > 10 * 1024 * 1024);
    if (invalid) {
      setError(`${invalid.name}: only Word/PDF files up to 10 MB each are allowed.`);
      return;
    }
    setError("");
    setFiles((current) => [...current, ...selectedFiles.filter((file) => !current.some((existing) => existing.name === file.name && existing.size === file.size))]);
  }
  return (
    <AppShell title={`Main | ${formName}`}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-medium text-gray-600">{formName}</h1>
            <p className="mt-1 text-sm text-zinc-950/60">
              {mode === "REGISTRATION" ? "Manage registration forms for public courses." : "Manage request forms for private and in-house courses."} Send completed forms to the admin (QPD).
            </p>
          </div>
          <Button onClick={openNew} leftIcon={<Plus size={18} />}>
            Add {formName}
          </Button>
        </section>
        <section className="flex flex-col gap-6 rounded-3xl border border-rose-50 bg-white p-5">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 xl:max-w-60">
              Search Quotation Code
              <span className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900/40"
                />
                <input
                  className="h-9 w-full rounded-full border border-rose-600 bg-neutral-50 pl-9 pr-3 text-sm outline-none"
                  placeholder="Example: QTN-0926-001"
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                />
              </span>
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Class Type",
                  value: deliveryType,
                  set: setDeliveryType,
                  options: [["ALL", "All Type"], ...deliveryOptions],
                },
                {
                  label: "Company",
                  value: accountFilter,
                  set: setAccountFilter,
                  options: [
                    ["ALL", "All Company"],
                    ...accounts.map((account) => [account.id, account.name]),
                  ],
                },
                {
                  label: "Status",
                  value: status,
                  set: setStatus,
                  options: [
                    ["ALL", "All Status"],
                    ["DRAFT", "Draft"],
                    ["WAITING", "Waiting"],
                    ["REVISION", "Revision"],
                    ["APPROVED", "Approved"],
                  ],
                },
              ].map((filter) => (
                <label
                  key={filter.label}
                  className="flex min-w-40 flex-col gap-[3px] text-sm text-gray-600"
                >
                  {filter.label}
                  <span className="relative">
                    <select
                      className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-sm text-slate-900/60 outline-none"
                      value={filter.value}
                      onChange={(e) => {
                        setPage(1);
                        filter.set(e.target.value);
                      }}
                    >
                      {filter.options.map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600"
                    />
                  </span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="p-8 text-center text-sm text-gray-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="rounded-xl bg-neutral-100 text-gray-600">
                  <tr>
                    {[
                      "REQUEST FORM #",
                      "QUOTATION",
                      "ACCOUNT",
                      "REQUESTED COURSE",
                      "TYPE",
                      "STUDENTS",
                      "REQUESTED DATE",
                      "STATUS",
                      "ACTION",
                    ].map((heading) => (
                      <th className="px-3 py-3 text-xs font-medium" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const badgeClass =
                      item.status === "WAITING"
                        ? "border-orange-600 bg-orange-600/10 text-orange-600"
                        : item.status === "REVISION"
                          ? "border-red-500 bg-red-500/10 text-red-500"
                          : item.status === "APPROVED"
                            ? "border-green-500 bg-green-500/10 text-green-600"
                            : "border-gray-300 bg-gray-100 text-gray-600";
                    return (
                      <tr className="border-b border-rose-50 text-zinc-950/60" key={item.id}>
                        <td className="whitespace-nowrap px-3 py-3 font-medium">{item.request_form_number}</td>
                        <td className="px-3 py-3 font-medium">
                          {item.quotation_code ?? "-"}
                        </td>
                        <td className="px-3 py-3 font-medium">
                          {item.account_name}
                          <div className="text-xs font-normal text-zinc-950/50">
                            {item.pic_name}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {item.requested_course ?? `${item.course_count} course(s)`}
                        </td>
                        <td className="px-3 py-3">
                          {item.delivery_type ? deliveryTypeLabel(item.delivery_type) : "-"}
                        </td>
                        <td className="px-3 py-3">{item.students ?? "-"}</td>
                        <td className="px-3 py-3">
                          {formatSessionDates(item.requested_dates?.split(",") ?? [])}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${badgeClass}`}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              aria-label="View request form"
                              className="rounded-full p-2 text-zinc-950/60 hover:bg-neutral-100"
                              onClick={() => void showDetails(item.id)}
                            >
                              <Eye size={17} />
                            </button>
                            {(item.status === "DRAFT" || item.status === "REVISION") && (
                              <Button size="sm" className="min-w-max shrink-0 whitespace-nowrap bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white hover:to-[#F90237]" onClick={() => void openEdit(item.id)}>
                                Edit Form
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!items.length && (
                    <tr>
                      <td className="p-8 text-center text-gray-500" colSpan={9}>
                        No Request Forms found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / 8))}
            pageSize={items.length}
            totalItems={total}
            onPageChange={setPage}
          />
        </section>
      </div>
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-[902px] overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-medium text-gray-600">
                {editingId ? `Edit ${formName}` : `Create ${formName}`}
              </h2>
              <button className="flex size-8 items-center justify-center rounded-full text-gray-600 hover:bg-neutral-100" onClick={() => setEditor(false)} aria-label="Close">
                ✕
              </button>
            </div>
            {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            <div className="grid gap-6 lg:h-[520px] lg:grid-cols-2">
              <div className="space-y-6 overflow-y-auto rounded-3xl border border-gray-200 p-4">
                <h3 className="font-medium text-slate-900">Quotation Details</h3>
                <div className="flex gap-2 rounded-full border border-rose-600 bg-neutral-50 p-1">
                  <button type="button" disabled={Boolean(editingId)} className={`flex-1 rounded-full px-3 py-2 text-xs font-medium ${sourceTab === "QUOTATION" ? "bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white" : "text-rose-600"}`} onClick={() => { setSourceTab("QUOTATION"); setQuotationId(""); setQuotePreview(null); setAccountId(""); setPicId(""); setLines([{ ...emptyCourse(), deliveryType: mode === "REGISTRATION" ? "PUBLIC" : "PRIVATE" }]); }}>Pick Quotation</button>
                  <button type="button" disabled={Boolean(editingId)} className={`flex-1 rounded-full px-3 py-2 text-xs font-medium ${sourceTab === "MANUAL" ? "bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white" : "text-rose-600"}`} onClick={() => { setSourceTab("MANUAL"); setQuotationId(""); setQuotePreview(null); setAccountId(""); setPicId(""); setLines([{ ...emptyCourse(), deliveryType: mode === "REGISTRATION" ? "PUBLIC" : "PRIVATE" }]); }}>Without Quotation</button>
                </div>
                {sourceTab === "QUOTATION" && <label className="block text-sm">
                  Pick approved Quotation
                  <select
                    className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-rose-200"
                    value={quotationId}
                    disabled={Boolean(editingId && quotationId)}
                    onChange={async (e) => {
                      const q = e.target.value;
                      setQuotationId(q);
                      if (q) {
                        try {
                          const preview = await api<QuotePreview>(
                            `/api/v1/internal/request-forms/quotations/${q}/preview?formType=${mode}`
                          );
                          setQuotePreview(preview);
                          setAccountId(preview.quote.account_id);
                          setPicId(preview.quote.pic_profile_id);
                          setLines(
                            preview.lines.slice(0, 1).map((line) => ({
                              ...emptyCourse(),
                              courseId: line.course_id,
                              amountStudent: Number(line.amount_student),
                              deliveryType: preview.quote.class_type as DetailCourse["deliveryType"],
                              locationType: preview.quote.class_type.startsWith("ONLINE") ? "ONLINE" : preview.quote.class_type === "INHOUSE" ? "CLIENT" : "INTERNAL",
                            }))
                          );
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : "Could not load quotation preview"
                          );
                        }
                      } else {
                        setQuotePreview(null);
                        setAccountId("");
                        setPicId("");
                        setLines([emptyCourse()]);
                      }
                    }}
                  >
                    <option value="">Pick a Quotation Number</option>
                    {quotes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.quotation_code} — {q.account_name} / {q.pic_name}
                      </option>
                    ))}
                  </select>
                </label>}
                {quotationId && (
                  <section className="space-y-3">
                    <h4 className="text-base font-medium text-gray-600">Quotation Preview</h4>
                    <div className="space-y-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-600">
                            {quotePreview?.quote.quotation_code ??
                              quotes.find((q) => q.id === quotationId)?.quotation_code}
                          </p>
                          <p className="text-sm text-zinc-950/60">{quotePreview?.quote.account_name ?? quotes.find((q) => q.id === quotationId)?.account_name}</p>
                        </div>
                        <span className="rounded-full border border-green-500 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600">
                          Approved
                        </span>
                      </div>
                      <div className="h-px bg-zinc-950/15" />
                      <div className="space-y-3 text-sm">{[["PIC", quotePreview?.quote.pic_name ?? quotes.find((q) => q.id === quotationId)?.pic_name ?? "-"], ["PIC Email", quotePreview?.quote.pic_email ?? "-"], ["Course", quotePreview?.lines.map((line) => line.course_name).join(", ") ?? "-"], ["Course Type", quotePreview?.quote.class_type ? deliveryTypeLabel(quotePreview.quote.class_type) : "-"], ["Amount Student", quotePreview?.lines.reduce((sum, line) => sum + Number(line.amount_student), 0) ?? "-"]].map(([label, value]) => <div className="grid grid-cols-[9rem_1fr] gap-3" key={label}><span className="text-zinc-950/60">{label}</span><span className="font-medium text-gray-600">{value}</span></div>)}</div>
                      <p className="text-xs text-zinc-950/60">
                        Quotation commercial terms are locked and copied to this Request Form.
                      </p>
                    </div>
                    {quotePreview && <fieldset className="space-y-2 rounded-xl border border-rose-50 p-3">
                      <legend className="px-1 text-sm font-medium text-gray-600">Choose one Course for this {formName} *</legend>
                      {quotePreview.lines.map((line) => <label className="flex items-start gap-2 text-sm text-gray-600" key={line.course_id}>
                        <input className="mt-1 accent-rose-600" type="radio" name="quotation-course" checked={lines.some((selectedLine) => selectedLine.courseId === line.course_id)} onChange={() => toggleQuotationCourse(line.course_id)} />
                        <span>{line.course_name}<span className="block text-xs text-zinc-950/60">{line.amount_student} students</span></span>
                      </label>)}
                    </fieldset>}
                  </section>
                )}
                {sourceTab === "MANUAL" && (
                  <>
                    <label className="block text-sm">
                      Account *
                      <select
                        className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-rose-200"
                        value={accountId}
                        onChange={(e) => {
                          setAccountId(e.target.value);
                          setPicId("");
                        }}
                      >
                        <option value="">Pick an Account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      PIC *
                      <select
                        className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-rose-200"
                        value={picId}
                        onChange={(e) => setPicId(e.target.value)}
                      >
                        <option value="">Pick a PIC</option>
                        {pics.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.email}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {sourceTab === "MANUAL" && <section className="space-y-3"><h4 className="text-base font-medium text-gray-600">Course Detail</h4>{lines.map((line, index) => <div className="space-y-2 rounded-xl border border-rose-50 bg-neutral-50 p-3" key={index}><span className="text-sm font-medium text-gray-600">Course</span><label className="block text-sm text-gray-600">Requested Course *<select className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-rose-200" value={line.courseId} onChange={(e) => updateLine(index, { courseId: e.target.value })}><option value="">Pick a Course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="text-sm text-gray-600">Student Amount *<input className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-rose-200" type="number" min={1} value={line.amountStudent} onChange={(e) => updateLine(index, { amountStudent: Number(e.target.value) })} /></label><label className="text-sm text-gray-600">Class Format *<select className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-rose-200" value={line.deliveryType.startsWith("ONLINE") ? "ONLINE" : "OFFLINE"} onChange={(e) => updateCourseFormat(index, e.target.value as "ONLINE" | "OFFLINE")}><option value="OFFLINE">Offline</option><option value="ONLINE">Online</option></select></label></div><label className="block text-sm text-gray-600">Class Type *<select className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-rose-200" value={line.deliveryType} onChange={(e) => updateCourseDeliveryType(index, e.target.value)}>{deliveryOptions.filter(([value]) => line.deliveryType.startsWith("ONLINE") ? value.startsWith("ONLINE") : !value.startsWith("ONLINE")).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>)}</section>}
              </div>
              <div className="space-y-4 overflow-y-auto pr-1">
                <div className="flex items-center gap-2 text-base font-medium text-slate-900"><span className="flex size-5 items-center justify-center text-zinc-950/60">▣</span>{formName}</div>
                <label className="flex cursor-pointer flex-col gap-1 text-sm text-gray-600">
                  {mode === "REGISTRATION" ? "Registration Attachment *" : "RF Attachment *"}
                  <span className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-rose-600 bg-neutral-50 p-5 text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white"><Plus size={20} /></span>
                    <span className="text-sm text-gray-600">Drag / Drop files here or <span className="text-rose-600">Choose files from Computer</span></span>
                    <input className="sr-only" type="file" multiple accept=".pdf,.doc,.docx" onChange={(e) => void addFiles(e)} />
                  </span>
                  <span className="text-sm text-zinc-950/60">(Word, PDF), Max size 10MB per file</span>
                  {files.map((f, index) => <span key={`${f.name}-${f.size}-${index}`} className="flex items-center justify-between gap-2 text-xs text-rose-600">{f.name}<button type="button" className="text-red-500" aria-label={`Remove ${f.name}`} onClick={(event) => { event.preventDefault(); setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index)); }}>Remove</button></span>)}
                </label>
                <label className="block text-sm text-gray-600">Training Title *<input readOnly className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-600 outline-none" placeholder="Generated from selected Course" value={trainingTitle} /></label>
                {lines.map((line, index) => (
                  <article key={index} className="space-y-3 rounded-2xl border border-rose-50 p-4">
                    {mode === "REGISTRATION" && !line.deliveryType.startsWith("ONLINE") && line.deliveryType !== "INHOUSE" && <fieldset className="space-y-2 text-sm"><legend className="text-gray-600">Training Location *</legend><div className="flex gap-5"><label className="inline-flex items-center gap-2"><input type="radio" className="accent-rose-600" name={`location-${index}`} checked={line.locationType === "INTERNAL"} onChange={() => updateLine(index, { locationType: "INTERNAL", locationName: "", locationAddress: "" })} />Internal Training Room</label><label className="inline-flex items-center gap-2"><input type="radio" className="accent-rose-600" name={`location-${index}`} checked={line.locationType === "CLIENT"} onChange={() => updateLine(index, { locationType: "CLIENT" })} />Client Location</label></div></fieldset>}
                    {mode === "REQUEST" && line.deliveryType === "INHOUSE" && <label className="block text-sm text-gray-600">Location Training *<input required className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm" maxLength={500} value={[line.locationName, line.locationAddress].filter(Boolean).join(" · ")} onChange={(e) => updateLine(index, { locationName: "", locationAddress: e.target.value })} placeholder="Training location name and address" /></label>}
                    {mode === "REGISTRATION" && line.locationType === "CLIENT" && <div className="grid gap-2 sm:grid-cols-2"><label className="block text-sm text-gray-600">Location Name *<input required className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm" value={line.locationName} onChange={(e) => updateLine(index, { locationName: e.target.value })} placeholder="Client site / venue" /></label><label className="block text-sm text-gray-600">Location Address *<input required className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm" value={line.locationAddress} onChange={(e) => updateLine(index, { locationAddress: e.target.value })} placeholder="Full address" /></label></div>}
                    {line.locationType === "ONLINE" && <p className="text-sm text-zinc-950/60">Online training does not require a physical location.</p>}
                    <label className="block text-sm text-gray-600">Requested Date *</label>
                    <MultiDateCalendar dates={line.sessions.map((session) => session.date)} onChange={(dates) => updateLine(index, { sessions: dates.map((date) => ({ date })) })} />
                    <label className="block text-sm text-gray-600">Language *
                      <select className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-rose-200" value={line.language} onChange={(e) => updateLine(index, { language: e.target.value })}>
                        <option>Indonesia</option><option>English</option>
                      </select>
                    </label>
                    <fieldset className="space-y-1 text-sm">
                      <legend className="text-gray-600">Class Type * (Pilih Satu)</legend>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-zinc-950/60">{[["STANDARD", "Standard"], ["CUSTOMIZED", "Customized"], ["CEO", "CEO"]].map(([value, label]) => <label className="inline-flex items-center gap-2" key={value}><input className="accent-rose-600" type="radio" name={`service-${index}`} checked={line.serviceType === value} onChange={() => updateLine(index, { serviceType: value })} />{label}</label>)}</div>
                    </fieldset>
                    <fieldset className="space-y-1 text-sm">
                      <legend className="text-gray-600">Room Rental</legend>
                      <div className="flex gap-6 text-zinc-950/60">{[["YES", "Yes"], ["NO", "No"]].map(([value, label]) => <label className="inline-flex items-center gap-2" key={value}><input className="accent-rose-600" type="radio" name={`rental-${index}`} checked={line.roomRental === (value === "YES")} onChange={() => updateLine(index, { roomRental: value === "YES", roomPc: null, roomServices: [] })} />{label}</label>)}</div>
                    </fieldset>
                    {line.roomRental === true && (
                      <div className="space-y-2 rounded-xl bg-neutral-50 p-3">
                        <p className="text-sm font-medium">Room Rental Services</p>
                        <div className="flex flex-wrap gap-3 text-sm">
                          <label>
                            <input
                              type="radio"
                              name={`pc-${index}`}
                              checked={line.roomPc === "WITH"}
                              onChange={() => updateLine(index, { roomPc: "WITH" })}
                            />{" "}
                            With PC
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`pc-${index}`}
                              checked={line.roomPc === "WITHOUT"}
                              onChange={() => updateLine(index, { roomPc: "WITHOUT" })}
                            />{" "}
                            Without PC
                          </label>
                          {["INTERNET", "LAN", "SNACKS", "LUNCH"].map((service) => (
                            <label key={service}>
                              <input
                                type="checkbox"
                                checked={line.roomServices.includes(service)}
                                onChange={(e) =>
                                  updateLine(index, {
                                    roomServices: e.target.checked
                                      ? [...line.roomServices, service]
                                      : line.roomServices.filter((v) => v !== service),
                                  })
                                }
                              />{" "}
                              {service}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
                <section className="space-y-3 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-medium text-rose-600">Special Instructions / Notes</h3>
                    <Button size="sm" variant="primary" leftIcon={<Plus size={15} />} onClick={() => setNotes((current) => [...current, ""])}>Add Notes</Button>
                  </div>
                  <div className="h-px bg-zinc-950/20" />
                  {notes.map((note, index) => (
                    <div className="flex items-end gap-3" key={index}>
                      <label className="flex-1 text-sm text-gray-600">
                        Notes #{index + 1}
                        <input className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-rose-200" value={note} placeholder="Add a note" onChange={(event) => setNotes((current) => current.map((value, noteIndex) => noteIndex === index ? event.target.value : value))} />
                      </label>
                      <Button size="icon" variant="danger" aria-label={`Remove note ${index + 1}`} onClick={() => setNotes((current) => current.filter((_, noteIndex) => noteIndex !== index))}>×</Button>
                    </div>
                  ))}
                </section>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEditor(false)}>
                Cancel
              </Button>
              <Button variant="soft" disabled={busy} onClick={() => void save(false)}>
                {busy ? "Saving…" : "Save Draft"}
              </Button>
              <Button disabled={busy} onClick={() => void save(true)}>
                {busy ? "Submitting…" : "Submit to Admin (QPD)"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[92vh] w-full max-w-[902px] overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between"><h2 className="text-2xl font-medium text-gray-600">{formName} Details</h2><button className="flex size-8 items-center justify-center rounded-full text-xl text-gray-600 hover:bg-neutral-100" aria-label="Close" onClick={() => setSelected(null)}>✕</button></div>
            <div className="mb-4 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-gray-600">Request Form #: <span className="font-medium">{selected.item.request_form_number}</span>{selected.item.training_id && <> <span className="mx-2 text-zinc-400">·</span> Training ID: <span className="font-medium">{selected.item.training_id}</span></>}</div>
            {selected.item.review_note && <p className="mb-4 rounded-xl border border-red-500 bg-red-50 p-3 text-sm text-red-600">Revision note: {selected.item.review_note}</p>}
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-4 rounded-3xl border border-gray-200 p-4">
                <h3 className="text-base font-medium text-slate-900">{selected.item.quotation_id ? "Quotation Details" : "Without Quotation"}</h3>
                {selected.item.quotation_id ? <><h4 className="text-base font-medium text-gray-600">Quotation Preview</h4><div className="space-y-4 rounded-xl border border-rose-50 bg-neutral-50 p-3">
                  <div className="flex items-center justify-between gap-3"><div><p className="font-medium text-gray-600">{selected.item.quotation_code ?? "-"}</p><p className="text-sm font-medium text-zinc-950/60">{selected.item.account_name}</p></div><span className="rounded-full border border-green-500 bg-green-500/20 px-3 py-1 text-xs font-medium text-green-600">Approved</span></div><div className="h-px bg-zinc-950/20" />
                  <div className="space-y-3 text-sm">{[["PIC", selected.item.pic_name], ["PIC Email", selected.item.pic_email ?? "-"], ["Course", selected.courses.map((c) => String(c.course_name)).join(", ")], ["Course Type", selected.item.quotation_class_type?.replace("INHOUSE", "In-house") ?? selected.courses.map((c) => String(c.delivery_type)).join(", ")], ["Amount Student", selected.courses.reduce((sum, c) => sum + Number(c.amount_student ?? 0), 0)]].map(([label, value]) => <div className="grid grid-cols-[9rem_1fr] gap-3" key={label}><span className="text-zinc-950/60">{label}</span><span className="font-medium text-gray-600">{value}</span></div>)}</div>
                </div></> : <div className="space-y-3 rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm"><div className="grid grid-cols-[9rem_1fr] gap-3"><span className="text-zinc-950/60">PIC</span><span className="font-medium text-gray-600">{selected.item.pic_name}</span></div><div className="grid grid-cols-[9rem_1fr] gap-3"><span className="text-zinc-950/60">PIC Email</span><span className="font-medium text-gray-600">{selected.item.pic_email ?? "-"}</span></div><div className="grid grid-cols-[9rem_1fr] gap-3"><span className="text-zinc-950/60">Account</span><span className="font-medium text-gray-600">{selected.item.account_name}</span></div><div className="grid grid-cols-[9rem_1fr] gap-3"><span className="text-zinc-950/60">Course Type</span><span className="font-medium text-gray-600">{selected.courses.map((c) => String(c.delivery_type).replace("INHOUSE", "In-house")).join(", ")}</span></div><div className="grid grid-cols-[9rem_1fr] gap-3"><span className="text-zinc-950/60">Amount Student</span><span className="font-medium text-gray-600">{selected.courses.reduce((sum, c) => sum + Number(c.amount_student ?? 0), 0)}</span></div></div>}
              </section>
              <section className="space-y-5 rounded-3xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between"><h3 className="text-base font-medium text-slate-900">{formName}</h3><span className={`rounded-full border px-3 py-1 text-xs font-medium ${selected.item.status === "WAITING" ? "border-orange-400 bg-orange-400/20 text-orange-500" : selected.item.status === "REVISION" ? "border-red-500 bg-red-500/10 text-red-500" : selected.item.status === "APPROVED" ? "border-green-500 bg-green-500/20 text-green-600" : "border-gray-300 bg-gray-100 text-gray-600"}`}>{statusLabel(selected.item.status)}</span></div>
                <div className="text-sm text-gray-600">Training Title <span className="font-medium">{selected.item.training_title || "-"}</span></div>
                <div className="space-y-2"><h4 className="text-sm text-gray-600">{mode === "REGISTRATION" ? "Registration Attachment" : "RF Attachment"}</h4>{selected.attachments.length ? selected.attachments.map((a) => <a className="flex items-center justify-between gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3" href={a.download_url} target="_blank" rel="noreferrer" key={a.id}><span className="truncate font-medium text-gray-600">{a.file_name}<small className="block font-medium text-rose-600">{(a.file_size / 1024 / 1024).toFixed(1)} MB</small></span><span className="rounded-full bg-radial-[at_50%_0%] from-red-400 to-rose-600 px-3 py-2 text-white">↗</span></a>) : <p className="rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-950/60">No attachment uploaded</p>}</div>
                <div className="space-y-3"><h4 className="text-base font-medium text-rose-600">Detail Course</h4>{selected.courses.map((course) => <div className="space-y-2 rounded-xl border border-rose-50 bg-neutral-50 p-3" key={String(course.id)}><div className="flex justify-between gap-3"><div><p className="font-medium text-gray-600">{String(course.course_name)}</p><p className="text-sm font-medium text-rose-600">{String(course.language)} · {String(course.amount_student)} students</p></div><span className="text-right text-xs font-medium text-zinc-950/60">{formatSessionDates((course.sessions as Array<Record<string, string>>).map((session) => String(session.date).slice(0, 10)))}</span></div><p className="text-xs text-zinc-950/60">{String(course.delivery_type).replace("INHOUSE", "In-house")} · {String(course.service_type)}</p><p className="text-xs text-zinc-950/60">Location: {course.location_type === "CLIENT" ? [course.location_name, course.location_address].filter(Boolean).join(" · ") || "-" : course.location_type === "ONLINE" ? "Online" : "Internal Training Room"}</p>{Boolean(course.room_rental) && <p className="text-xs text-zinc-950/60">Room Rental: {String(course.room_pc ?? "")} {(course.room_services as string[]).join(", ")}</p>}{Boolean(course.special_instruction) && <p className="text-sm text-zinc-950/60">{String(course.special_instruction)}</p>}</div>)}</div>
                <div className="space-y-2"><h4 className="text-base font-medium text-rose-600">Special Instructions</h4><div className="whitespace-pre-line rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-950/60">{[...new Set(selected.courses.flatMap((c) => String(c.special_instruction ?? "").split("\n")).filter(Boolean))].join("\n") || "-"}</div></div>
              </section>
            </div>
            <div className="mt-6 flex justify-between border-t border-zinc-950/20 pt-5">{selected.item.status === "DRAFT" ? <Button variant="danger" disabled={busy} onClick={async () => { if (!window.confirm("Delete this draft? This cannot be undone.")) return; setBusy(true); try { await api(`/api/v1/internal/request-forms/${selected.item.id}`, { method: "DELETE" }); showToast(`${formName} draft deleted successfully.`); setSelected(null); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete draft"); } finally { setBusy(false); } }}>Delete Draft</Button> : selected.item.status === "WAITING" ? <Button variant="ghost" className="border border-rose-600 text-rose-600 hover:bg-rose-50" disabled={busy} onClick={() => setWithdrawConfirmationOpen(true)}>Withdraw to Draft</Button> : <span /> }<Button onClick={() => setSelected(null)}>Close</Button></div>
          </div>
        </div>
      )}
      <WithdrawConfirmation
        open={withdrawConfirmationOpen}
        onClose={() => setWithdrawConfirmationOpen(false)}
        onConfirm={() => void withdrawSelected()}
        loading={busy}
      />
    </AppShell>
  );
}
