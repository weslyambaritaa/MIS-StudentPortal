"use client";
import { DropdownSelect } from "@mis/ui/dropdown-select";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@mis/ui/badge";
import { Button, AddButton } from "@mis/ui/button";
import { DeleteConfirmationModal } from "@mis/ui/delete-confirmation-modal";
import { Dropdown } from "@mis/ui/dropdown";
import { EmptyState } from "@mis/ui/empty-state";
import { IconButton } from "@mis/ui/icon-button";
import { Input } from "@mis/ui/input";
import { NumberInput } from "@mis/ui/number-input";
import { LordIcon } from "@mis/ui/lord-icon";
import { Pagination } from "@mis/ui/pagination";
import { useToast } from "@mis/ui/toast";
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
  quote: {
    account_id: string;
    pic_profile_id: string;
    quotation_code: string;
    class_type: string;
    account_name: string;
    pic_name: string;
    pic_email: string;
  };
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
  item: Row & {
    quotation_id: string | null;
    account_id: string;
    pic_profile_id: string;
    pic_email?: string;
    quotation_class_type?: string | null;
    training_title?: string | null;
  };
  courses: Array<Record<string, unknown>>;
  attachments: Array<{ id: string; file_name: string; file_size: number; download_url: string }>;
};

const statusLabel = (status: Row["status"]) =>
  ({ DRAFT: "Draft", WAITING: "Waiting", REVISION: "Declined", APPROVED: "Approved" })[status];

const statusVariant = (status: Row["status"]) =>
  status === "APPROVED"
    ? ("success" as const)
    : status === "WAITING"
      ? ("warning" as const)
      : status === "REVISION"
        ? ("danger" as const)
        : ("neutral" as const);

const deliveryTypeLabel = (type: string) =>
  (({
    PUBLIC: "Public",
    PRIVATE: "Private",
    INHOUSE: "In-house",
    ONLINE_PRIVATE: "Online Private",
    ONLINE_PUBLIC: "Online Public",
  }) as Record<string, string>)[type] ?? type;

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
    for (let index = 0; index < days.length; ) {
      let end = index;
      while (end + 1 < days.length && days[end + 1] === days[end] + 1) end += 1;
      chunks.push(end > index ? `${days[index]}–${days[end]}` : String(days[index]));
      index = end + 1;
    }
    const monthName = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(
      new Date(year, month - 1, 1),
    );
    return `${chunks.join(", ")} ${monthName}${years.size > 1 ? ` ${year}` : ""}`;
  });
  return `${formatted.join(", ")}${years.size === 1 ? ` ${[...years][0]}` : ""}`;
}

function QuotationPreviewCard({
  quotationCode,
  accountName,
  picName,
  picEmail,
  courseName,
  courseType,
  amountStudent,
  requestedDate,
}: {
  quotationCode: string;
  accountName: string;
  picName: string;
  picEmail: string;
  courseName: string;
  courseType: string;
  amountStudent: string | number;
  requestedDate: string;
}) {
  return (
    <div className="w-full max-w-sm rounded-xl bg-neutral-50 p-3 outline outline-1 outline-offset-[-1px] outline-rose-50 inline-flex flex-col justify-center items-start gap-4 overflow-hidden">
      <div className="self-stretch inline-flex justify-start items-center gap-3">
        <div className="size-10 px-3 py-2.5 bg-radial-[at_50%_0%] from-red-400 to-orange-600 rounded-[100px] flex justify-center items-center gap-3 shrink-0">
          <LordIcon src="receipt" size={20} colors="primary:#ffffff,secondary:#ffffff" />
        </div>
        <div className="flex-1 inline-flex flex-col justify-center items-start gap-0.5 min-w-0">
          <div className="self-stretch truncate text-gray-600 text-base font-medium font-['DM_Sans']">
            {quotationCode || "-"}
          </div>
          <div className="self-stretch truncate text-zinc-950/60 text-sm font-medium font-['DM_Sans']">
            {accountName || "-"}
          </div>
        </div>
        <Badge variant="success" showDot>
          Approved
        </Badge>
      </div>
      <div className="self-stretch h-px bg-zinc-950/20" />
      <div className="self-stretch flex flex-col justify-start items-start gap-3">
        <div className="self-stretch inline-flex justify-start items-start gap-6">
          <div className="w-36 flex shrink-0 justify-start items-center gap-2">
            <LordIcon src="avatar-circle" size={18} colors="primary:#09090b,secondary:#09090b" />
            <div className="text-zinc-950/60 text-sm font-normal font-['DM_Sans']">PIC</div>
          </div>
          <div className="flex-1 truncate text-gray-600 text-sm font-medium font-['DM_Sans']">
            {picName || "-"}
          </div>
        </div>
        <div className="self-stretch inline-flex justify-start items-start gap-6">
          <div className="w-36 flex shrink-0 justify-start items-center gap-2">
            <LordIcon src="mail" size={18} colors="primary:#09090b,secondary:#09090b" />
            <div className="text-zinc-950/60 text-sm font-normal font-['DM_Sans']">PIC Email</div>
          </div>
          <div className="flex-1 truncate text-gray-600 text-sm font-medium font-['DM_Sans']">
            {picEmail || "-"}
          </div>
        </div>
        <div className="self-stretch inline-flex justify-start items-start gap-6">
          <div className="w-36 flex shrink-0 justify-start items-center gap-2">
            <LordIcon src="book" size={18} colors="primary:#09090b,secondary:#09090b" />
            <div className="text-zinc-950/60 text-sm font-normal font-['DM_Sans']">Course</div>
          </div>
          <div className="flex-1 truncate text-gray-600 text-sm font-medium font-['DM_Sans']">
            {courseName || "-"}
          </div>
        </div>
        <div className="self-stretch inline-flex justify-start items-start gap-6">
          <div className="w-36 flex shrink-0 justify-start items-center gap-2">
            <LordIcon src="bookmark" size={18} colors="primary:#09090b,secondary:#09090b" />
            <div className="text-zinc-950/60 text-sm font-normal font-['DM_Sans']">Course Type</div>
          </div>
          <div className="flex-1 truncate text-gray-600 text-sm font-medium font-['DM_Sans']">
            {courseType || "-"}
          </div>
        </div>
        <div className="self-stretch inline-flex justify-start items-start gap-6">
          <div className="w-36 flex shrink-0 justify-start items-center gap-2">
            <LordIcon src="users" size={18} colors="primary:#09090b,secondary:#09090b" />
            <div className="text-zinc-950/60 text-sm font-normal font-['DM_Sans']">Amount Student</div>
          </div>
          <div className="flex-1 truncate text-gray-600 text-sm font-medium font-['DM_Sans']">
            {amountStudent || "-"}
          </div>
        </div>
        <div className="self-stretch inline-flex justify-start items-center gap-6">
          <div className="w-36 flex shrink-0 justify-start items-center gap-2">
            <LordIcon src="calendar-dots" size={18} colors="primary:#09090b,secondary:#09090b" />
            <div className="text-zinc-950/60 text-sm font-normal font-['DM_Sans']">Requested Date</div>
          </div>
          <div className="flex-1 truncate text-gray-600 text-sm font-medium font-['DM_Sans']">
            {requestedDate || "-"}
          </div>
        </div>
      </div>
    </div>
  );
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
  const cells = Array.from(
    { length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 },
    (_, index) => {
      const day = index - firstWeekday + 1;
      return day > 0 && day <= daysInMonth ? day : null;
    },
  );
  const chosen = new Set(dates);
  const dateFor = (day: number) =>
    `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  function toggleDate(value: string) {
    onChange(chosen.has(value) ? dates.filter((date) => date !== value) : [...dates, value].sort());
  }
  return (
    <div className="space-y-3 rounded-xl border border-rose-600 bg-neutral-50 p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className="rounded-full p-2 text-rose-600 hover:bg-rose-50"
          onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-gray-600">
          {new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(month)}
        </span>
        <button
          type="button"
          aria-label="Next month"
          className="rounded-full p-2 text-rose-600 hover:bg-rose-50"
          onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-950/60">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
          <span className="py-1" key={day}>
            {day}
          </span>
        ))}
        {cells.map((day, index) =>
          day === null ? (
            <span aria-hidden="true" key={`empty-${index}`} />
          ) : (
            <button
              type="button"
              key={dateFor(day)}
              aria-label={new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(
                new Date(year, monthIndex, day),
              )}
              aria-pressed={chosen.has(dateFor(day))}
              onClick={() => toggleDate(dateFor(day))}
              className={`mx-auto flex size-9 items-center justify-center rounded-full text-sm ${
                chosen.has(dateFor(day))
                  ? "bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white"
                  : "text-gray-600 hover:bg-rose-100"
              }`}
            >
              {day}
            </button>
          ),
        )}
      </div>
      <p className="border-t border-rose-100 pt-2 text-xs text-zinc-950/60">
        {dates.length ? formatSessionDates(dates) : "Pilih satu atau beberapa tanggal"}
      </p>
    </div>
  );
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
  const [isClosingDetails, setIsClosingDetails] = useState(false);
  const [withdrawConfirmationOpen, setWithdrawConfirmationOpen] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState<Details | null>(null);
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
  const deliveryOptions: Array<[string, string]> =
    mode === "REGISTRATION"
      ? [
          ["PUBLIC", "Public"],
          ["ONLINE_PUBLIC", "Online Public"],
        ]
      : [
          ["PRIVATE", "Private"],
          ["INHOUSE", "In-house"],
          ["ONLINE_PRIVATE", "Online Private"],
        ];

  const trainingTitle = [
    ...new Set(
      lines
        .map((line) => courses.find((course) => course.id === line.courseId)?.name)
        .filter(Boolean),
    ),
  ].join(" + ");

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
          `/api/v1/internal/request-forms/options?formType=${mode}`,
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
    setLines([
      {
        ...emptyCourse(),
        deliveryType: mode === "REGISTRATION" ? "PUBLIC" : "PRIVATE",
        locationType: "INTERNAL",
      },
    ]);
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
        const preview = await api<QuotePreview>(
          `/api/v1/internal/request-forms/quotations/${value.item.quotation_id}/preview?formType=${mode}`,
        );
        setQuotePreview(preview);
      } else {
        setQuotePreview(null);
      }
      setAccountId(value.item.account_id);
      setPicId(value.item.pic_profile_id);
      setNotes(
        String(value.courses[0]?.special_instruction ?? "")
          .split("\n")
          .filter(Boolean),
      );
      setLines(
        value.courses.slice(0, 1).map((c) => ({
          courseId: String(c.course_id),
          amountStudent: Number(c.amount_student) || 1,
          deliveryType: String(c.delivery_type),
          serviceType: String(c.service_type || "STANDARD"),
          language: String(c.language || "Indonesia"),
          roomRental: c.room_rental === null ? null : Boolean(c.room_rental),
          roomPc: c.room_pc ? String(c.room_pc) : null,
          roomServices: Array.isArray(c.room_services) ? (c.room_services as string[]) : [],
          locationType: c.location_type
            ? (String(c.location_type) as DetailCourse["locationType"])
            : "INTERNAL",
          locationName: String(c.location_name ?? ""),
          locationAddress: String(c.location_address ?? ""),
          specialInstruction: String(c.special_instruction ?? ""),
          sessions: (c.sessions as Array<Record<string, string>>).map((s) => ({
            date: String(s.date).slice(0, 10),
          })),
        })),
      );
      setFiles([]);
      setEditor(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open Request Form");
    }
  }

  function updateLine(index: number, change: Partial<DetailCourse>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...change } : line)),
    );
  }

  function updateCourseDeliveryType(index: number, value: string) {
    const isOnline = value.startsWith("ONLINE");
    const isClient = value === "INHOUSE";
    updateLine(index, {
      deliveryType: value,
      locationType: isOnline ? "ONLINE" : isClient ? "CLIENT" : "INTERNAL",
      locationName: isOnline || !isClient ? "" : lines[index].locationName,
      locationAddress: isOnline || !isClient ? "" : lines[index].locationAddress,
    });
  }

  function toggleQuotationCourse(courseId: string) {
    const quotationLine = quotePreview?.lines.find((line) => line.course_id === courseId);
    if (!quotationLine || !quotePreview) return;
    setLines([
      {
        ...emptyCourse(),
        courseId,
        amountStudent: Number(quotationLine.amount_student) || 1,
        deliveryType: quotePreview.quote.class_type,
        locationType: quotePreview.quote.class_type.startsWith("ONLINE")
          ? "ONLINE"
          : quotePreview.quote.class_type === "INHOUSE"
            ? "CLIENT"
            : "INTERNAL",
        locationName: "",
        locationAddress: "",
      },
    ]);
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
        courses: lines.map((line) => {
          const isOnline = line.deliveryType.startsWith("ONLINE");
          const isClient = line.deliveryType === "INHOUSE" || line.locationType === "CLIENT";
          const locationType = isOnline ? "ONLINE" : isClient ? "CLIENT" : "INTERNAL";
          return {
            ...line,
            amountStudent: Number(line.amountStudent) || 1,
            serviceType: mode === "REGISTRATION" ? "STANDARD" : line.serviceType || "STANDARD",
            roomRental: mode === "REGISTRATION" ? false : line.roomRental,
            roomPc: mode === "REGISTRATION" || !line.roomRental ? null : line.roomPc,
            roomServices: mode === "REGISTRATION" || !line.roomRental ? [] : line.roomServices,
            locationType,
            locationName: locationType === "CLIENT" ? line.locationName || "" : "",
            locationAddress: locationType === "CLIENT" ? line.locationAddress || "Client Location" : "",
            specialInstruction: notes.filter((note) => note.trim()).join("\n"),
          };
        }),
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
      showToast(
        submit
          ? `${formName} submitted to Admin successfully.`
          : wasEditing
            ? `${formName} draft updated successfully.`
            : `${formName} draft saved successfully.`,
      );
      setEditor(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not save ${formName}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (!deletingDraft) return;
    setBusy(true);
    try {
      await api(`/api/v1/internal/request-forms/${deletingDraft.item.id}`, { method: "DELETE" });
      showToast(`${formName} draft deleted successfully.`);
      setDeletingDraft(null);
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete draft");
      setDeletingDraft(null);
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

  function handleCloseDetails() {
    setIsClosingDetails(true);
    setTimeout(() => {
      setSelected(null);
      setIsClosingDetails(false);
    }, 250);
  }

  function addFiles(selectedFiles: File[]) {
    const allowed = /\.(pdf|doc|docx)$/i;
    const invalid = selectedFiles.find(
      (file) => !allowed.test(file.name) || file.size > 10 * 1024 * 1024,
    );
    if (invalid) {
      setError(`${invalid.name}: only Word/PDF files up to 10 MB each are allowed.`);
      return;
    }
    setError("");
    setFiles((current) => [
      ...current,
      ...selectedFiles.filter(
        (file) => !current.some((existing) => existing.name === file.name && existing.size === file.size),
      ),
    ]);
  }

  // Filter quotations matching current mode
  const filteredQuotes = quotes.filter((q) =>
    mode === "REGISTRATION"
      ? q.class_type === "PUBLIC" || q.class_type === "ONLINE_PUBLIC"
      : q.class_type === "PRIVATE" ||
        q.class_type === "INHOUSE" ||
        q.class_type === "ONLINE_PRIVATE",
  );

  return (
    <AppShell title={`Main | ${formName}`}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-medium text-gray-600">{formName}</h1>
            <p className="mt-1 text-sm text-zinc-950/60">
              {mode === "REGISTRATION"
                ? "Manage registration forms for public courses."
                : "Manage request forms for private and in-house courses."}{" "}
              Send completed forms to the admin (QPD).
            </p>
          </div>
          <AddButton onClick={openNew}>Add {formName}</AddButton>
        </section>
        <section className="flex flex-col gap-6 rounded-3xl border border-rose-50 bg-white p-5">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <Input
              label="Search Quotation Code"
              leftIcon="search"
              placeholder="Example: QTN-0926-001"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              containerClassName="w-full xl:max-w-60"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Dropdown
                label="Class Type"
                value={deliveryType}
                onChange={(val) => {
                  setPage(1);
                  setDeliveryType(val);
                }}
                options={[
                  { label: "All Type", value: "ALL" },
                  ...deliveryOptions.map(([val, label]) => ({ label, value: val })),
                ]}
                containerClassName="min-w-40"
              />
              <Dropdown
                label="Company"
                searchable
                value={accountFilter}
                onChange={(val) => {
                  setPage(1);
                  setAccountFilter(val);
                }}
                options={[
                  { label: "All Company", value: "ALL" },
                  ...accounts.map((account) => ({ label: account.name, value: account.id })),
                ]}
                containerClassName="min-w-40"
              />
              <Dropdown
                label="Status"
                value={status}
                onChange={(val) => {
                  setPage(1);
                  setStatus(val);
                }}
                options={[
                  { label: "All Status", value: "ALL" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Waiting", value: "WAITING" },
                  { label: "Revision", value: "REVISION" },
                  { label: "Approved", value: "APPROVED" },
                ]}
                containerClassName="min-w-40"
              />
            </div>
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          {!loading && items.length === 0 ? (
            <EmptyState
              description={`No ${formName}s Found`}
              onAdd={openNew}
              addLabel={`Add ${formName}`}
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-[#E9E9E9]">
                <table className="table-fixed w-full min-w-[960px] text-left text-sm">
                  <thead className="bg-neutral-100 text-sm font-normal text-zinc-950/60 border-b border-[#E9E9E9]">
                    <tr>
                      <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Request Form #</th>
                      <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Quotation</th>
                      <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Account</th>
                      <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Requested Course</th>
                      <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Type</th>
                      <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Students</th>
                      <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Requested Date</th>
                      <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Status</th>
                      <th className="w-44 whitespace-nowrap px-6 py-3 font-normal text-zinc-950/60 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-[#E9E9E9] text-zinc-700 transition-colors hover:bg-neutral-50/50"
                      >
                        <td className="whitespace-nowrap px-3 py-3 font-medium">
                          {item.request_form_number}
                        </td>
                        <td className="px-3 py-3 font-medium">{item.quotation_code ?? "-"}</td>
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
                          <Badge variant={statusVariant(item.status)} showDot>
                            {statusLabel(item.status)}
                          </Badge>
                        </td>
                        <td className="w-44 whitespace-nowrap px-6 py-2">
                          <div className="flex items-center gap-1">
                            <IconButton
                              label={`View ${formName}`}
                              icon="eye"
                              size="sm"
                              onClick={() => void showDetails(item.id)}
                            />
                            {(item.status === "DRAFT" || item.status === "REVISION") && (
                              <IconButton
                                label="Edit form"
                                icon="pencil-line"
                                size="sm"
                                onClick={() => void openEdit(item.id)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {loading && (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                          Loading {formName}s…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 w-full">
                <Pagination
                  page={page}
                  totalPages={Math.max(1, Math.ceil(total / 8))}
                  pageSize={items.length}
                  totalItems={total}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </section>
      </div>

      {/* Create / Edit Modal */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-[920px] overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-medium text-gray-600">
                {editingId ? `Edit ${formName}` : `Create ${formName}`}
              </h2>
              <IconButton label="Close" size="sm" icon="cross" onClick={() => setEditor(false)} />
            </div>
            {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            <div className="grid gap-6 lg:h-[540px] lg:grid-cols-2">
              {/* Left Column: Quotation / Manual Details */}
              <div className="space-y-6 overflow-y-auto rounded-3xl border border-gray-200 p-4">
                <h3 className="font-medium text-slate-900">Quotation Details</h3>
                <div className="flex gap-2 rounded-full border border-rose-600 bg-neutral-50 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={sourceTab === "QUOTATION" ? "primary" : "ghost"}
                    disabled={Boolean(editingId)}
                    className="flex-1"
                    onClick={() => {
                      setSourceTab("QUOTATION");
                      setQuotationId("");
                      setQuotePreview(null);
                      setAccountId("");
                      setPicId("");
                      setLines([
                        {
                          ...emptyCourse(),
                          deliveryType: mode === "REGISTRATION" ? "PUBLIC" : "PRIVATE",
                          locationType: "INTERNAL",
                        },
                      ]);
                    }}
                  >
                    Pick Quotation
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sourceTab === "MANUAL" ? "primary" : "ghost"}
                    disabled={Boolean(editingId)}
                    className="flex-1"
                    onClick={() => {
                      setSourceTab("MANUAL");
                      setQuotationId("");
                      setQuotePreview(null);
                      setAccountId("");
                      setPicId("");
                      setLines([
                        {
                          ...emptyCourse(),
                          deliveryType: mode === "REGISTRATION" ? "PUBLIC" : "PRIVATE",
                          locationType: "INTERNAL",
                        },
                      ]);
                    }}
                  >
                    Without Quotation
                  </Button>
                </div>

                {sourceTab === "QUOTATION" && (
                  <Dropdown
                    label="Pick approved Quotation"
                    disabled={Boolean(editingId && quotationId)}
                    searchable
                    placeholder="Pick a Quotation Number"
                    value={quotationId}
                    onChange={async (q) => {
                      setQuotationId(q);
                      if (q) {
                        try {
                          const preview = await api<QuotePreview>(
                            `/api/v1/internal/request-forms/quotations/${q}/preview?formType=${mode}`,
                          );
                          setQuotePreview(preview);
                          setAccountId(preview.quote.account_id);
                          setPicId(preview.quote.pic_profile_id);
                          setLines(
                            preview.lines.slice(0, 1).map((line) => ({
                              ...emptyCourse(),
                              courseId: line.course_id,
                              amountStudent: Number(line.amount_student) || 1,
                              deliveryType: preview.quote.class_type as DetailCourse["deliveryType"],
                              locationType: preview.quote.class_type.startsWith("ONLINE")
                                ? "ONLINE"
                                : preview.quote.class_type === "INHOUSE"
                                  ? "CLIENT"
                                  : "INTERNAL",
                            })),
                          );
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : "Could not load quotation preview",
                          );
                        }
                      } else {
                        setQuotePreview(null);
                        setAccountId("");
                        setPicId("");
                        setLines([emptyCourse()]);
                      }
                    }}
                    options={filteredQuotes.map((q) => ({
                      label: `${q.quotation_code} — ${q.account_name} / ${q.pic_name ?? "No PIC"}`,
                      value: q.id,
                    }))}
                  />
                )}

                {quotationId && (
                  <section className="space-y-3">
                    <h4 className="text-base font-medium text-gray-600">Quotation Preview</h4>
                    <QuotationPreviewCard
                      quotationCode={
                        quotePreview?.quote.quotation_code ??
                        quotes.find((q) => q.id === quotationId)?.quotation_code ??
                        "-"
                      }
                      accountName={
                        quotePreview?.quote.account_name ??
                        quotes.find((q) => q.id === quotationId)?.account_name ??
                        "-"
                      }
                      picName={
                        quotePreview?.quote.pic_name ??
                        quotes.find((q) => q.id === quotationId)?.pic_name ??
                        "-"
                      }
                      picEmail={quotePreview?.quote.pic_email ?? "-"}
                      courseName={
                        quotePreview?.lines.find((l) => l.course_id === lines[0]?.courseId)
                          ?.course_name ??
                        quotePreview?.lines.map((l) => l.course_name).join(", ") ??
                        "-"
                      }
                      courseType={deliveryTypeLabel(quotePreview?.quote.class_type ?? "")}
                      amountStudent={
                        lines[0]?.amountStudent ??
                        quotePreview?.lines.reduce((sum, l) => sum + Number(l.amount_student), 0) ??
                        "-"
                      }
                      requestedDate={
                        lines[0]?.sessions.length
                          ? formatSessionDates(lines[0].sessions.map((s) => s.date))
                          : "-"
                      }
                    />

                    {quotePreview && quotePreview.lines.length > 1 && (
                      <fieldset className="space-y-2 rounded-xl border border-rose-50 p-3">
                        <legend className="px-1 text-sm font-medium text-gray-600">
                          Choose one Course for this {formName}{" "}
                          <span className="text-[#de1641] font-semibold">*</span>
                        </legend>
                        {quotePreview.lines.map((line) => (
                          <label
                            className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer"
                            key={line.course_id}
                          >
                            <input
                              className="mt-1 accent-rose-600"
                              type="radio"
                              name="quotation-course"
                              checked={lines.some((selectedLine) => selectedLine.courseId === line.course_id)}
                              onChange={() => toggleQuotationCourse(line.course_id)}
                            />
                            <span>
                              {line.course_name}
                              <span className="block text-xs text-zinc-950/60">
                                {line.amount_student} students
                              </span>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                    )}
                  </section>
                )}

                {sourceTab === "MANUAL" && (
                  <>
                    <Dropdown
                      label="Account"
                      required
                      searchable
                      placeholder="Pick an Account"
                      value={accountId}
                      onChange={(val) => {
                        setAccountId(val);
                        setPicId("");
                      }}
                      options={accounts.map((a) => ({ label: a.name, value: a.id }))}
                    />
                    <Dropdown
                      label="PIC"
                      required
                      searchable
                      placeholder="Pick a PIC"
                      value={picId}
                      onChange={(val) => setPicId(val)}
                      options={pics.map((p) => ({
                        label: `${p.name} — ${p.email}`,
                        value: p.id,
                      }))}
                    />

                    <section className="space-y-4">
                      <h4 className="text-base font-medium text-gray-600">Course Detail</h4>
                      {lines.map((line, index) => (
                        <div
                          className="space-y-3 rounded-xl border border-rose-50 bg-neutral-50 p-3"
                          key={index}
                        >
                          <Dropdown
                            label="Requested Course"
                            required
                            searchable
                            placeholder="Pick a Course"
                            value={line.courseId}
                            onChange={(val) => updateLine(index, { courseId: val })}
                            options={courses.map((c) => ({ label: c.name, value: c.id }))}
                          />

                          <NumberInput
                            label="Amount Student"
                            required
                            min={1}
                            value={line.amountStudent}
                            onChange={(e) =>
                              updateLine(index, { amountStudent: Number(e.target.value) })
                            }
                          />

                          {/* For Registration Form: Public vs Online Public */}
                          {mode === "REGISTRATION" && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-sm text-gray-600">Class Type *</span>
                              <div className="flex items-center gap-6">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateLine(index, {
                                      deliveryType: "PUBLIC",
                                      locationType: "INTERNAL",
                                    })
                                  }
                                  className="flex items-center gap-2 text-sm text-zinc-950/60 cursor-pointer"
                                >
                                  <div
                                    className={`size-3 rounded-full border border-rose-600 flex items-center justify-center ${
                                      line.deliveryType === "PUBLIC" ? "bg-rose-600" : "bg-white"
                                    }`}
                                  >
                                    {line.deliveryType === "PUBLIC" && (
                                      <div className="size-1 rounded-full bg-white" />
                                    )}
                                  </div>
                                  <span>Public</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateLine(index, {
                                      deliveryType: "ONLINE_PUBLIC",
                                      locationType: "ONLINE",
                                    })
                                  }
                                  className="flex items-center gap-2 text-sm text-zinc-950/60 cursor-pointer"
                                >
                                  <div
                                    className={`size-3 rounded-full border border-rose-600 flex items-center justify-center ${
                                      line.deliveryType === "ONLINE_PUBLIC"
                                        ? "bg-rose-600"
                                        : "bg-white"
                                    }`}
                                  >
                                    {line.deliveryType === "ONLINE_PUBLIC" && (
                                      <div className="size-1 rounded-full bg-white" />
                                    )}
                                  </div>
                                  <span>Online Public</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </section>
                  </>
                )}
              </div>

              {/* Right Column: Form Inputs */}
              <div className="space-y-5 overflow-y-auto pr-1">
                <div className="flex items-center gap-2 text-base font-medium text-slate-900">
                  <LordIcon src="file-text" size={20} colors="primary:#09090b,secondary:#09090b" />
                  <span>{formName}</span>
                </div>
{/* Attachment Dropzone */}
<div className="flex flex-col gap-1 text-sm">
  <span className="text-gray-600">
    {mode === "REGISTRATION" ? "Registration Attachment" : "RF Attachment"}{" "}
    <span className="font-semibold text-rose-600">*</span>
  </span>

  <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-rose-600 bg-neutral-50 p-6 text-center">
    <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-r from-red-400 to-rose-600 text-white">
      <LordIcon src="upload" size={20} colors="primary:#ffffff,secondary:#ffffff" />
    </span>
    <span className="text-sm text-gray-600">
      Drag / Drop files here or{" "}
      <span className="text-rose-600">Choose files from Computer</span>
    </span>
    <input
      className="sr-only"
      type="file"
      multiple
      accept=".pdf,.doc,.docx"
      onChange={(event) => {
        if (event.target.files) addFiles(Array.from(event.target.files));
      }}
    />
  </label>

  <span className="text-sm text-zinc-950/60">(Word, PDF), Max size 10MB</span>
  {files.map((file, index) => (
    <span
      key={`${file.name}-${file.size}-${index}`}
      className="flex items-center justify-between gap-2 text-xs text-rose-600"
    >
      {file.name}
      <IconButton
        size="sm"
        variant="danger"
        icon="trash"
        label={`Remove ${file.name}`}
        onClick={(event) => {
          event.preventDefault();
          setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
        }}
      />
    </span>
  ))}
</div>

{/* Training Title — tampilkan sekali */}
<div className="flex flex-col gap-[3px]">
  <span className="text-sm text-gray-600">Training Title *</span>
  <div className="flex h-9 items-center rounded-full border border-rose-600 bg-neutral-50 px-3">
    <span className="truncate text-sm text-slate-900/60">
      {trainingTitle || "Example: Power BI Fundamental"}
    </span>
  </div>
</div>

{/* Isian yang berlaku untuk setiap course */}
{lines.map((line, index) => (
  <article key={index} className="space-y-3 rounded-2xl border border-rose-50 p-4">
    {mode === "REGISTRATION" &&
      !line.deliveryType.startsWith("ONLINE") &&
      line.deliveryType !== "INHOUSE" && (
        <fieldset className="space-y-2 text-sm">
          <legend className="text-gray-600">Training Location *</legend>
          <div className="flex gap-5">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                className="accent-rose-600"
                name={`location-${index}`}
                checked={line.locationType === "INTERNAL"}
                onChange={() =>
                  updateLine(index, {
                    locationType: "INTERNAL",
                    locationName: "",
                    locationAddress: "",
                  })
                }
              />
              Internal Training Room
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                className="accent-rose-600"
                name={`location-${index}`}
                checked={line.locationType === "CLIENT"}
                onChange={() => updateLine(index, { locationType: "CLIENT" })}
              />
              Client Location
            </label>
          </div>
        </fieldset>
      )}

    {mode === "REQUEST" && line.deliveryType === "INHOUSE" && (
      <Input
        label="Location Training"
        required
        maxLength={500}
        value={[line.locationName, line.locationAddress].filter(Boolean).join(" · ")}
        onChange={(event) =>
          updateLine(index, { locationName: "", locationAddress: event.target.value })
        }
        placeholder="Training location name and address"
      />
    )}

    {mode === "REGISTRATION" && line.locationType === "CLIENT" && (
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          label="Location Name"
          required
          value={line.locationName}
          onChange={(event) => updateLine(index, { locationName: event.target.value })}
          placeholder="Client site / venue"
        />
        <Input
          label="Location Address"
          required
          value={line.locationAddress}
          onChange={(event) => updateLine(index, { locationAddress: event.target.value })}
          placeholder="Full address"
        />
      </div>
    )}

    {line.locationType === "ONLINE" && (
      <p className="text-sm text-zinc-950/60">
        Online training does not require a physical location.
      </p>
    )}

    <div className="space-y-1">
      <span className="text-sm text-gray-600">Requested Date *</span>
      <MultiDateCalendar
        dates={line.sessions.map((session) => session.date)}
        onChange={(dates) =>
          updateLine(index, { sessions: dates.map((date) => ({ date })) })
        }
      />
    </div>

    <Dropdown
      label="Language"
      required
      value={line.language}
      onChange={(value) => updateLine(index, { language: value })}
      options={[
        { label: "Indonesia", value: "Indonesia" },
        { label: "English", value: "English" },
      ]}
    />

    {mode === "REQUEST" && (
      <div className="space-y-3">
        <fieldset className="space-y-1 text-sm">
          <legend className="text-gray-600">Class Category *</legend>
          <div className="flex flex-wrap gap-4">
            {(["STANDARD", "CUSTOMIZED", "CEO"] as const).map((value) => (
              <label key={value} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  className="accent-rose-600"
                  name={`service-${index}`}
                  checked={line.serviceType === value}
                  onChange={() => updateLine(index, { serviceType: value })}
                />
                {value === "CUSTOMIZED" ? "Customized" : value}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1 text-sm">
          <legend className="text-gray-600">Class Format *</legend>
          <div className="flex flex-wrap gap-4">
            {[
              ["ONLINE_PRIVATE", "Online"],
              ["PRIVATE", "Offline"],
              ["INHOUSE", "Hybrid"],
            ].map(([value, label]) => (
              <label key={value} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  className="accent-rose-600"
                  name={`format-${index}`}
                  checked={line.deliveryType === value}
                  onChange={() => updateCourseDeliveryType(index, value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    )}

    <fieldset className="space-y-1 text-sm">
      <legend className="text-gray-600">Room Rental</legend>
      <div className="flex gap-6">
        {[
          ["YES", "Yes"],
          ["NO", "No"],
        ].map(([value, label]) => (
          <label key={value} className="inline-flex items-center gap-2">
            <input
              type="radio"
              className="accent-rose-600"
              name={`rental-${index}`}
              checked={line.roomRental === (value === "YES")}
              onChange={() =>
                updateLine(index, {
                  roomRental: value === "YES",
                  roomPc: null,
                  roomServices: [],
                })
              }
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>

    {line.roomRental === true && (
      <div className="space-y-2 rounded-xl bg-neutral-50 p-3">
        <p className="text-sm font-medium">Room Rental Services</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {(["WITH", "WITHOUT"] as const).map((value) => (
            <label key={value} className="inline-flex items-center gap-2">
              <input
                type="radio"
                name={`pc-${index}`}
                checked={line.roomPc === value}
                onChange={() => updateLine(index, { roomPc: value })}
              />
              {value === "WITH" ? "With PC" : "Without PC"}
            </label>
          ))}
          {["INTERNET", "LAN", "SNACKS", "LUNCH"].map((service) => (
            <label key={service} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={line.roomServices.includes(service)}
                onChange={(event) =>
                  updateLine(index, {
                    roomServices: event.target.checked
                      ? [...line.roomServices, service]
                      : line.roomServices.filter((item) => item !== service),
                  })
                }
              />
              {service}
            </label>
          ))}
        </div>
      </div>
    )}
  </article>
))}
                        </div>
                      </div>

                      {lines[0]?.roomRental === true && (
                        <div className="p-3 bg-neutral-50 rounded-xl outline outline-1 outline-offset-[-1px] outline-rose-50 flex flex-col justify-center items-start gap-3 overflow-hidden">
                          <div className="inline-flex items-center gap-1">
                            <LordIcon src="room" size={18} colors="primary:#de1641,secondary:#de1641" />
                            <span className="text-rose-600 text-sm font-medium font-['DM_Sans']">
                              Room Rental Services
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => updateLine(0, { roomPc: "WITH" })}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <div
                                className={`size-3 rounded-full border border-rose-600 flex items-center justify-center ${
                                  lines[0]?.roomPc === "WITH" ? "bg-rose-600" : "bg-white"
                                }`}
                              >
                                {lines[0]?.roomPc === "WITH" && (
                                  <div className="size-1 rounded-full bg-white" />
                                )}
                              </div>
                              <span className="text-zinc-950/60 text-sm font-normal font-['DM_Sans']">
                                With PC
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateLine(0, { roomPc: "WITHOUT" })}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <div
                                className={`size-3 rounded-full border border-rose-600 flex items-center justify-center ${
                                  lines[0]?.roomPc === "WITHOUT" ? "bg-rose-600" : "bg-white"
                                }`}
                              >
                                {lines[0]?.roomPc === "WITHOUT" && (
                                  <div className="size-1 rounded-full bg-white" />
                                )}
                              </div>
                              <span className="text-zinc-950/60 text-sm font-normal font-['DM_Sans']">
                                Without PC
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Location Training for Inhouse */}
                {lines[0]?.deliveryType === "INHOUSE" && (
                  <Input
                    label="Location Training"
                    required
                    maxLength={500}
                    value={[lines[0]?.locationName, lines[0]?.locationAddress]
                      .filter(Boolean)
                      .join(" · ")}
                    onChange={(e) =>
                      updateLine(0, { locationName: "", locationAddress: e.target.value })
                    }
                    placeholder="Training location name and address"
                  />
                )}

                {/* Special Instructions / Notes */}
                <div className="bg-white flex flex-col justify-start items-start gap-3 pt-2">
                  <div className="self-stretch inline-flex justify-between items-center">
                    <span className="text-rose-600 text-base font-medium font-['DM_Sans']">
                      Special Instructions / Notes
                    </span>
                    <AddButton size="sm" onClick={() => setNotes((current) => [...current, ""])}>
                      Add Notes
                    </AddButton>
                  </div>
                  <div className="self-stretch h-px bg-zinc-950/20" />
                  {notes.map((note, index) => (
                    <div className="self-stretch inline-flex justify-start items-end gap-3" key={index}>
                      <div className="flex-1 inline-flex flex-col justify-start items-start gap-[3px]">
                        <span className="text-gray-600 text-sm font-normal font-['DM_Sans']">
                          Notes #{index + 1}
                        </span>
                        <input
                          className="self-stretch h-9 px-3 py-2 bg-neutral-50 rounded-[100px] outline outline-1 outline-offset-[-1px] outline-rose-600 text-sm text-gray-600 focus:outline-rose-600 focus:ring-1 focus:ring-rose-200"
                          value={note}
                          placeholder="Add a note"
                          onChange={(event) =>
                            setNotes((current) =>
                              current.map((value, noteIndex) =>
                                noteIndex === index ? event.target.value : value,
                              ),
                            )
                          }
                        />
                      </div>
                      <IconButton
                        size="sm"
                        variant="danger"
                        icon="trash"
                        label={`Remove note ${index + 1}`}
                        onClick={() =>
                          setNotes((current) =>
                            current.filter((_, noteIndex) => noteIndex !== index),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEditor(false)}>
                Cancel
              </Button>
              <Button variant="soft" disabled={busy} onClick={() => void save(false)}>
                {busy ? "Saving…" : "Save Draft"}
              </Button>
              <Button
                disabled={busy}
                onClick={() => void save(true)}
                leftIcon={editingId ? "pencil-line" : "plus"}
              >
                {busy ? "Submitting…" : "Submit to Admin (QPD)"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Details Slide-Over Dialog */}
      {selected && (
        <div
          className={`fixed inset-0 z-50 flex justify-end bg-zinc-950/30 backdrop-blur-[1px] ${
            isClosingDetails ? "animate-fade-out" : "animate-fade-in"
          }`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCloseDetails();
          }}
        >
          <aside
            aria-label={`${formName} details`}
            className={`relative z-10 flex h-full w-full max-w-[850px] flex-col justify-between overflow-hidden border-l border-gray-200 bg-white p-6 shadow-xl ${
              isClosingDetails ? "animate-slide-out-right" : "animate-slide-in-right"
            }`}
          >
            <div className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
              <div className="flex shrink-0 items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <IconButton label="Close details" size="sm" icon="cross" onClick={handleCloseDetails} />
                  <h2 className="text-2xl font-medium text-gray-600">{formName} Details</h2>
                </div>
                <Badge variant={statusVariant(selected.item.status)} showDot>
                  {statusLabel(selected.item.status)}
                </Badge>
              </div>

              <div className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-gray-600">
                Request Form #:{" "}
                <span className="font-medium text-gray-900">{selected.item.request_form_number}</span>
                {selected.item.training_id && (
                  <>
                    <span className="mx-2 text-zinc-400">·</span> Training ID:{" "}
                    <span className="font-medium text-gray-900">{selected.item.training_id}</span>
                  </>
                )}
              </div>

              {selected.item.review_note && (
                <p className="rounded-xl border border-red-500 bg-red-50 p-3 text-sm text-red-600">
                  Revision note: {selected.item.review_note}
                </p>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Left: Quotation Preview or Manual Account Info */}
                <section className="space-y-4 rounded-3xl border border-gray-200 p-4">
                  <h3 className="text-base font-medium text-gray-600">
                    {selected.item.quotation_id ? "Quotation Preview" : "Without Quotation"}
                  </h3>
                  {selected.item.quotation_id ? (
                    <QuotationPreviewCard
                      quotationCode={selected.item.quotation_code ?? "-"}
                      accountName={selected.item.account_name ?? "-"}
                      picName={selected.item.pic_name ?? "-"}
                      picEmail={selected.item.pic_email ?? "-"}
                      courseName={
                        selected.courses.map((c) => String(c.course_name)).join(", ") || "-"
                      }
                      courseType={
                        selected.item.quotation_class_type
                          ? deliveryTypeLabel(selected.item.quotation_class_type)
                          : selected.courses
                              .map((c) => deliveryTypeLabel(String(c.delivery_type)))
                              .join(", ") || "-"
                      }
                      amountStudent={
                        selected.courses.reduce((sum, c) => sum + Number(c.amount_student ?? 0), 0) ||
                        "-"
                      }
                      requestedDate={formatSessionDates(
                        selected.courses.flatMap(
                          (c) =>
                            (c.sessions as Array<Record<string, string>>)?.map((s) =>
                              String(s.date).slice(0, 10),
                            ) ?? [],
                        ),
                      )}
                    />
                  ) : (
                    <div className="space-y-3 rounded-xl border border-rose-50 bg-neutral-50 p-4 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-zinc-950/60">Account</span>
                        <span className="font-medium text-gray-600">{selected.item.account_name}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-zinc-950/60">PIC</span>
                        <span className="font-medium text-gray-600">{selected.item.pic_name}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-zinc-950/60">PIC Email</span>
                        <span className="font-medium text-gray-600">{selected.item.pic_email ?? "-"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-zinc-950/60">Course Type</span>
                        <span className="font-medium text-gray-600">
                          {selected.courses
                            .map((c) => deliveryTypeLabel(String(c.delivery_type)))
                            .join(", ") || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-zinc-950/60">Amount Student</span>
                        <span className="font-medium text-gray-600">
                          {selected.courses.reduce(
                            (sum, c) => sum + Number(c.amount_student ?? 0),
                            0,
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </section>

                {/* Right: Form Details */}
                <section className="space-y-5 rounded-3xl border border-gray-200 bg-white p-4">
                  <h3 className="text-base font-medium text-gray-600">{formName}</h3>
                  <div className="text-sm text-gray-600">
                    Training Title:{" "}
                    <span className="font-medium text-gray-900">
                      {selected.item.training_title || "-"}
                    </span>
                  </div>

                  {/* Attachments */}
                  <div className="space-y-2">
                    <h4 className="text-sm text-gray-600">
                      {mode === "REGISTRATION" ? "Registration Attachment" : "RF Attachment"}
                    </h4>
                    {selected.attachments.length ? (
                      selected.attachments.map((a) => (
                        <a
                          className="flex items-center justify-between gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3 hover:bg-rose-50/50 transition-colors"
                          href={a.download_url}
                          target="_blank"
                          rel="noreferrer"
                          key={a.id}
                        >
                          <span className="truncate font-medium text-gray-600">
                            {a.file_name}
                            <small className="block font-medium text-rose-600">
                              {(a.file_size / 1024 / 1024).toFixed(1)} MB
                            </small>
                          </span>
                          <span className="rounded-full bg-radial-[at_50%_0%] from-red-400 to-rose-600 px-3 py-1 text-white text-xs">
                            Download
                          </span>
                        </a>
                      ))
                    ) : (
                      <p className="rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-950/60">
                        No attachment uploaded
                      </p>
                    )}
                  </div>

                  {/* Course Details */}
                  <div className="space-y-3">
                    <h4 className="text-base font-medium text-gray-600">Detail Course</h4>
                    {selected.courses.map((course) => (
                      <div
                        className="space-y-2 rounded-xl border border-rose-50 bg-neutral-50 p-3"
                        key={String(course.id)}
                      >
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="font-medium text-gray-600">{String(course.course_name)}</p>
                            <p className="text-sm font-medium text-rose-600">
                              {String(course.language)} · {String(course.amount_student)} students
                            </p>
                          </div>
                          <span className="text-right text-xs font-medium text-zinc-950/60">
                            {formatSessionDates(
                              (course.sessions as Array<Record<string, string>>).map((session) =>
                                String(session.date).slice(0, 10),
                              ),
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-950/60">
                          {deliveryTypeLabel(String(course.delivery_type))}
                          {mode === "REQUEST" && ` · ${String(course.service_type)}`}
                        </p>
                        {course.location_type === "CLIENT" ? (
                          <p className="text-xs text-zinc-950/60">
                            Location:{" "}
                            {[course.location_name, course.location_address].filter(Boolean).join(" · ") || "-"}
                          </p>
                        ) : course.location_type === "ONLINE" ? (
                          <p className="text-xs text-zinc-950/60">Location: Online</p>
                        ) : (
                          <p className="text-xs text-zinc-950/60">Location: Internal Training Room</p>
                        )}
                        {Boolean(course.room_rental) && (
                          <p className="text-xs text-zinc-950/60">
                            Room Rental: {String(course.room_pc ?? "")} PC
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Special Instructions */}
                  <div className="space-y-2">
                    <h4 className="text-base font-medium text-gray-600">Special Instructions</h4>
                    <div className="whitespace-pre-line rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-950/60">
                      {[
                        ...new Set(
                          selected.courses
                            .flatMap((c) => String(c.special_instruction ?? "").split("\n"))
                            .filter(Boolean),
                        ),
                      ].join("\n") || "-"}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="mt-6 flex justify-between border-t border-zinc-950/20 pt-5">
              {selected.item.status === "DRAFT" ? (
                <Button
                  variant="danger"
                  leftIcon="trash"
                  disabled={busy}
                  onClick={() => setDeletingDraft(selected)}
                >
                  Delete Draft
                </Button>
              ) : selected.item.status === "WAITING" ? (
                <Button
                  variant="ghost"
                  className="border border-rose-600 text-rose-600 hover:bg-rose-50"
                  disabled={busy}
                  onClick={() => setWithdrawConfirmationOpen(true)}
                >
                  Withdraw to Draft
                </Button>
              ) : (
                <span />
              )}
              <Button onClick={handleCloseDetails}>Close</Button>
            </div>
          </aside>
        </div>
      )}

      <WithdrawConfirmation
        open={withdrawConfirmationOpen}
        onClose={() => setWithdrawConfirmationOpen(false)}
        onConfirm={() => void withdrawSelected()}
        loading={busy}
      />
      <DeleteConfirmationModal
        open={Boolean(deletingDraft)}
        itemName={deletingDraft?.item.request_form_number ?? ""}
        description={`This ${formName} draft will be permanently deleted.`}
        onClose={() => setDeletingDraft(null)}
        onConfirm={() => void deleteDraft()}
        loading={busy}
      />
    </AppShell>
  );
}
