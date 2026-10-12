"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, ChevronDown, Eye, GraduationCap, Pencil, Plus, Search, Trash2, Users, Video, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useApi } from "@/hooks/use-api";
import {
  QuotationDetailsDialog,
  type QuotationDetail,
  type QuotationListItem,
  type QuotationStatus,
} from "./dialog/quotation-details-dialog";

type Status = QuotationStatus;
type Line = { courseId: string; amountStudent: number; pricePerPax: number; location: string };
type AccountOption = { id: string; account_code: string; name: string };
type CourseOption = { id: string; name: string; duration_minutes: number };
type PicOption = { id: string; name: string; email: string };
type Quote = QuotationListItem;
type PageResult = { items: Quote[]; page: number; pageSize: number; total: number };
type QuoteDetail = QuotationDetail;
const BLANK: PageResult = { items: [], page: 1, pageSize: 8, total: 0 };
const TYPES = ["PRIVATE", "PUBLIC", "INHOUSE", "ONLINE"] as const;
const typeLabel = (value: string) =>
  ({ PRIVATE: "Private", PUBLIC: "Public", INHOUSE: "Inhouse", ONLINE: "Online" })[value] ?? value;
const statusLabel = (value: Status) =>
  ({
    WAITING: "Waiting",
    SEND_FAILED: "Send failed",
    APPROVED: "Approved",
    CANCELLED: "Cancelled",
    REVISION: "Revision",
    DRAFT: "Draft",
    SENT: "Waiting",
    REJECTED: "Cancelled",
    EXPIRED: "Cancelled",
  })[value];
const statusVariant = (value: Status) =>
  value === "APPROVED"
    ? ("success" as const)
    : value === "WAITING" || value === "SENT"
      ? ("warning" as const)
      : value === "REVISION"
        ? ("neutral" as const)
      : value === "SEND_FAILED" || value === "CANCELLED" || value === "REJECTED"
        ? ("danger" as const)
        : ("neutral" as const);
const money = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;

export default function QuotationPage() {
  const api = useApi();
  const [result, setResult] = useState<PageResult>(BLANK);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [pics, setPics] = useState<PicOption[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editor, setEditor] = useState<QuoteDetail | null | undefined>(undefined);
  const [selected, setSelected] = useState<QuoteDetail | null>(null);
  const [deleting, setDeleting] = useState<Quote | null>(null);
  const [form, setForm] = useState<{
    quotationCode: string;
    accountId: string;
    picId: string;
    classType: (typeof TYPES)[number];
    lines: Line[];
  }>({
    quotationCode: "",
    accountId: "",
    picId: "",
    classType: "PRIVATE",
    lines: [{ courseId: "", amountStudent: 1, pricePerPax: 0, location: "" }],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: "8",
        status: statusFilter,
        courseId: courseFilter,
      });
      if (search) query.set("search", search);
      setResult(await api<PageResult>(`/api/v1/internal/quotations?${query}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load quotations");
    } finally {
      setLoading(false);
    }
  }, [api, page, statusFilter, courseFilter, search]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void api<{ accounts: AccountOption[]; courses: CourseOption[] }>(
      "/api/v1/internal/quotations/options"
    )
      .then(({ accounts: a, courses: c }) => {
        setAccounts(a);
        setCourses(c);
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Could not load quotation options")
      );
  }, [api]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchDraft.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);
  useEffect(() => {
    if (!form.accountId) {
      setPics([]);
      return;
    }
    void api<{ items: PicOption[] }>(`/api/v1/internal/quotations/accounts/${form.accountId}/pics`)
      .then((data) => {
        setPics(data.items);
        if (!data.items.some((pic) => pic.id === form.picId))
          setForm((current) => ({ ...current, picId: "" }));
      })
      .catch((cause) =>
        setDialogError(cause instanceof Error ? cause.message : "Could not load active PICs")
      );
  }, [api, form.accountId, form.picId]);

  const openEditor = async (quote?: Quote) => {
    setDialogError(null);
    if (!quote) {
      setForm({
        quotationCode: "",
        accountId: "",
        picId: "",
        classType: "PRIVATE",
        lines: [{ courseId: "", amountStudent: 1, pricePerPax: 0, location: "" }],
      });
      setEditor(null);
      return;
    }
    setBusy(true);
    try {
      const detail = await api<QuoteDetail>(`/api/v1/internal/quotations/${quote.id}`);
      setForm({
        quotationCode: detail.item.quotation_code,
        accountId: detail.item.account_id,
        picId: detail.item.pic_profile_id,
        classType: detail.item.class_type as (typeof TYPES)[number],
        lines: detail.lines.map((line) => ({
          courseId: line.course_id,
          amountStudent: Number(line.amount_student),
          pricePerPax: Number(line.price),
          location: line.location,
        })),
      });
      setEditor(detail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load quotation");
    } finally {
      setBusy(false);
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setDialogError(null);
    const created = editor === null;
    try {
      const body = JSON.stringify(form);
      await api(
        created ? "/api/v1/internal/quotations" : `/api/v1/internal/quotations/${editor!.item.id}`,
        { method: created ? "POST" : "PUT", body }
      );
      setEditor(undefined);
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not send quotation";
      if (created && message.includes("Quotation is saved")) {
        setEditor(undefined);
        setError(message);
        await load();
      } else setDialogError(message);
    } finally {
      setBusy(false);
    }
  };
  const showDetails = async (quote: Quote) => {
    try {
      setSelected(await api<QuoteDetail>(`/api/v1/internal/quotations/${quote.id}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load quotation details");
    }
  };
  const openDocument = async (quoteId: string, version: number) => {
    try {
      const result = await api<{ url: string }>(
        `/api/v1/internal/quotations/${quoteId}/documents/${version}`
      );
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open sent PDF");
    }
  };
  const updateStatus = async (quote: Quote, value: "APPROVED" | "CANCELLED" | "REVISION") => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/internal/quotations/${quote.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: value }),
      });
      setSelected(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  };
  const resend = async (quote: Quote) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/internal/quotations/${quote.id}/resend`, { method: "POST" });
      setSelected(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resend quotation");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/v1/internal/quotations/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      setSelected(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete quotation");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };
  const patchLine = (index: number, patch: Partial<Line>) =>
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  const columns: DataTableColumn<Quote>[] = [
    {
      key: "code",
      header: "No.",
      render: (row) => (
        <button
          className="font-medium text-rose-600 hover:underline"
          onClick={() => void showDetails(row)}
        >
          {row.quotation_code}
        </button>
      ),
    },
    {
      key: "account",
      header: "Account",
      render: (row) => (
        <div>
          {row.account_name}
          <div className="text-xs text-zinc-500">PIC: {row.pic_name}</div>
        </div>
      ),
    },
    { key: "course", header: "Requested Course", render: (row) => `${row.course_count} course(s)` },
    { key: "type", header: "Type", render: (row) => typeLabel(row.class_type) },
    { key: "students", header: "Students", render: (row) => Number(row.students || 0) },
    { key: "amount", header: "Amount", render: (row) => money(Number(row.amount)) },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={statusVariant(row.status)} showDot>
          {statusLabel(row.status)}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "Action",
      className: "whitespace-nowrap",
      render: (row) => (
        <div className="flex items-center gap-1">
          <IconButton
            label="View"
            icon={<Eye size={17} />}
            size="sm"
            onClick={() => void showDetails(row)}
          />
          <IconButton
            label="Edit and resend"
            icon={<Pencil size={17} />}
            size="sm"
            onClick={() => void openEditor(row)}
          />
          <IconButton
            label="Delete"
            icon={<Trash2 size={17} />}
            variant="danger"
            size="sm"
            onClick={() => setDeleting(row)}
          />
        </div>
      ),
    },
  ];
  const field =
    "h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-rose-100";
  const label = "flex flex-col gap-[3px] text-sm text-gray-600";

  return (
    <AppShell title="Main | Quotation">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-medium text-gray-600">Quotation</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-950/60">
              Training proposals sent to client PICs. An emailed quotation is set to Waiting and can
              be approved, cancelled, or marked for revision.
            </p>
          </div>
          <Button leftIcon={<Plus size={18} />} onClick={() => openEditor()}>
            Add Quotation
          </Button>
        </section>
        <section className="rounded-3xl border border-rose-50 bg-white p-5">
          <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <label className={`${label} w-full xl:w-60`}>
              Search Quotation
              <span className="flex h-9 items-center gap-2 rounded-full border border-rose-600 bg-neutral-50 px-3">
                <Search size={18} className="text-slate-900/40" />
                <input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="Example: QTN-000001"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-900/40"
                />
              </span>
            </label>
            <div className="flex gap-4">
              <label className={`${label} w-44`}>
                Course
                <span className="relative">
                  <select
                    className={`${field} appearance-none pr-9`}
                    value={courseFilter}
                    onChange={(e) => {
                      setPage(1);
                      setCourseFilter(e.target.value);
                    }}
                  >
                    <option value="ALL">All Course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600"
                  />
                </span>
              </label>
              <label className={`${label} w-40`}>
                Status
                <span className="relative">
                  <select
                    className={`${field} appearance-none pr-9`}
                    value={statusFilter}
                    onChange={(e) => {
                      setPage(1);
                      setStatusFilter(e.target.value);
                    }}
                  >
                    <option value="ALL">All Status</option>
                    <option value="WAITING">Waiting</option>
                    <option value="APPROVED">Approved</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="REVISION">Revision</option>
                    <option value="SEND_FAILED">Send failed</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600"
                  />
                </span>
              </label>
            </div>
          </div>
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {loading ? (
            <div className="py-10 text-center text-zinc-500">Loading quotations…</div>
          ) : (
            <DataTable
              columns={columns}
              rows={result.items}
              getRowKey={(row) => row.id}
              emptyMessage="No quotations found."
              caption="Sales quotations"
            />
          )}
          <div className="mt-1">
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))}
              pageSize={result.items.length}
              totalItems={result.total}
              onPageChange={setPage}
            />
          </div>
        </section>
      </div>

      <Modal
        open={editor !== undefined}
        onClose={() => !busy && setEditor(undefined)}
        className="max-h-[92vh] !max-w-96 overflow-y-auto"
      >
        {editor !== undefined && (
          <form onSubmit={save} className="flex flex-col gap-6">
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-medium text-gray-600">
                {editor ? "Edit Quotation" : "Add Quotation"}
              </h2>
              <IconButton
                label="Close"
                size="sm"
                icon={<X size={17} />}
                onClick={() => setEditor(undefined)}
              />
            </div>
            <section className="flex flex-col gap-1">
              <h3 className="text-base font-medium text-rose-600">Class / Course Type</h3>
              <div className="rounded-full border border-rose-600 bg-neutral-50 p-1">
                <div className="grid grid-cols-4 gap-1">
                  {TYPES.map((type) => {
                    const TypeIcon =
                      type === "PRIVATE"
                        ? GraduationCap
                        : type === "PUBLIC"
                          ? Users
                          : type === "INHOUSE"
                            ? Building2
                            : Video;
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={form.classType === type}
                        onClick={() => setForm((v) => ({ ...v, classType: type }))}
                        className={`flex h-8 min-w-0 items-center justify-center gap-1 rounded-full px-1 text-[10px] font-medium ${form.classType === type ? "bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white" : "text-rose-600"}`}
                      >
                        <TypeIcon size={13} />
                        <span>{typeLabel(type)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
            <div className="h-px w-full bg-zinc-950/20" />
            <label className={label}>
              Quotation Code *
              <input
                required
                maxLength={30}
                className={field}
                value={form.quotationCode}
                onChange={(e) => setForm((v) => ({ ...v, quotationCode: e.target.value }))}
                placeholder="Example: QTN-1234-13"
              />
            </label>
            <label className={label}>
              Account *
              <span className="relative">
                <select
                  required
                  className={`${field} appearance-none pr-9`}
                  value={form.accountId}
                  onChange={(e) => setForm((v) => ({ ...v, accountId: e.target.value, picId: "" }))}
                >
                  <option value="">Pick an active Account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-900/40"
                />
              </span>
            </label>
            <label className={label}>
              Person in Charge *
              <span className="relative">
                <select
                  required
                  className={`${field} appearance-none pr-9`}
                  value={form.picId}
                  onChange={(e) => setForm((v) => ({ ...v, picId: e.target.value }))}
                  disabled={!form.accountId}
                >
                  <option value="">Pick an active PIC</option>
                  {pics.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.email}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-900/40"
                />
              </span>
            </label>
            <label className={label}>
              Current Status *
              <input
                readOnly
                aria-readonly="true"
                className={`${field} cursor-not-allowed text-slate-900/40`}
                value={
                  editor ? "Waiting after successful resend" : "Waiting after successful email"
                }
              />
            </label>
            <div className="h-px w-full bg-zinc-950/20" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-rose-600">Quotation Details</h3>
              <Button
                size="sm"
                type="button"
                leftIcon={<Plus size={14} />}
                className="h-8 shrink-0 px-2 text-xs"
                onClick={() =>
                  setForm((v) => ({
                    ...v,
                    lines: [
                      ...v.lines,
                      { courseId: "", amountStudent: 1, pricePerPax: 0, location: "" },
                    ],
                  }))
                }
              >
                Multiple Class
              </Button>
            </div>
            {form.lines.map((line, index) => (
              <div key={index} className="flex flex-col gap-6">
                {form.lines.length > 1 && (
                  <div className="flex items-center justify-between text-xs font-medium text-rose-600">
                    Course {index + 1}
                    {index > 0 && (
                      <button
                        type="button"
                        aria-label="Remove course"
                        className="rounded-full p-1 text-rose-600 hover:bg-rose-50"
                        onClick={() =>
                          setForm((v) => ({ ...v, lines: v.lines.filter((_, i) => i !== index) }))
                        }
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                )}
                <label className={label}>
                  Requested Course *
                  <span className="relative">
                    <select
                      required
                      className={`${field} appearance-none pr-9`}
                      value={line.courseId}
                      onChange={(e) => patchLine(index, { courseId: e.target.value })}
                    >
                      <option value="">Courses Name - Days</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} - {Math.max(1, Math.ceil(c.duration_minutes / 480))} day(s)
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-900/40"
                    />
                  </span>
                </label>
                <label className={label}>
                  Amount Student (Pax) *
                  <input
                    required
                    min="1"
                    type="number"
                    className={field}
                    value={line.amountStudent}
                    onChange={(e) => patchLine(index, { amountStudent: Number(e.target.value) })}
                  />
                </label>
                <label className={label}>
                  Value Amount Per Pax (Rp) *
                  <input
                    required
                    min="1"
                    step="any"
                    type="number"
                    className={field}
                    value={line.pricePerPax || ""}
                    placeholder="50.000"
                    onChange={(e) => patchLine(index, { pricePerPax: Number(e.target.value) })}
                  />
                </label>
                <label className={label}>
                  Location *
                  <input
                    required
                    className={field}
                    value={line.location}
                    onChange={(e) => patchLine(index, { location: e.target.value })}
                    placeholder="Jakarta, ABC Tower"
                  />
                </label>
              </div>
            ))}
            {dialogError && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {dialogError}
              </p>
            )}
            <div className="flex justify-end gap-3 border-t border-zinc-950/10 pt-3">
              <Button
                variant="ghost"
                type="button"
                className="text-rose-600"
                onClick={() => setEditor(undefined)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || !form.lines.length}
                rightIcon={<Plus size={17} />}
              >
                {busy ? "Sending..." : editor ? "Update Quotation" : "Add Quotation"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <QuotationDetailsDialog
        quotation={selected}
        busy={busy}
        onClose={() => setSelected(null)}
        onDelete={setDeleting}
        onEdit={(quote) => {
          setSelected(null);
          void openEditor(quote);
        }}
        onResend={(quote) => void resend(quote)}
        onUpdateStatus={(quote, status) => void updateStatus(quote, status)}
        onOpenDocument={(quotationId, version) => void openDocument(quotationId, version)}
      />
      <DeleteConfirmationModal
        open={Boolean(deleting)}
        itemName={deleting?.quotation_code ?? ""}
        description={`Quotation “${deleting?.quotation_code ?? ""}” will be removed from the active list. Its sent PDF and audit history are retained.`}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
        loading={busy}
      />
    </AppShell>
  );
}
