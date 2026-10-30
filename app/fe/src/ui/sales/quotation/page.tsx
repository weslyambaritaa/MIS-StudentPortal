"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@mis/ui/badge";
import { Button, AddButton } from "@mis/ui/button";
import { DeleteConfirmationModal } from "@mis/ui/delete-confirmation-modal";
import { Dropdown } from "@mis/ui/dropdown";
import { EmptyState } from "@mis/ui/empty-state";
import { IconButton } from "@mis/ui/icon-button";
import { Input } from "@mis/ui/input";
import { Modal } from "@mis/ui/modal";
import { Pagination } from "@mis/ui/pagination";
import { useToast } from "@mis/ui/toast";
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
const TYPES = ["PRIVATE", "PUBLIC", "INHOUSE", "ONLINE_PUBLIC", "ONLINE_PRIVATE"] as const;
const typeLabel = (value: string) =>
  ({ PRIVATE: "Private", PUBLIC: "Public", INHOUSE: "In-house", ONLINE: "Online", ONLINE_PUBLIC: "Online Public", ONLINE_PRIVATE: "Online Private" })[value] ?? value;
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
  const { showToast } = useToast();
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
    status: "WAITING" | "APPROVED" | "CANCELLED" | "REVISION";
    lines: Line[];
  }>({
    quotationCode: "",
    accountId: "",
    picId: "",
    classType: "PRIVATE",
    status: "WAITING",
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
        status: "WAITING",
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
        status: ["WAITING", "APPROVED", "CANCELLED", "REVISION"].includes(detail.item.status) ? detail.item.status as "WAITING" | "APPROVED" | "CANCELLED" | "REVISION" : "WAITING",
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
    const previousStatus = editor?.item.status;
    try {
      const body = JSON.stringify({
        quotationCode: form.quotationCode,
        accountId: form.accountId,
        picId: form.picId,
        classType: form.classType,
        lines: form.lines,
      });
      const contentUnchanged = editor && form.quotationCode === editor.item.quotation_code
        && form.accountId === editor.item.account_id && form.picId === editor.item.pic_profile_id
        && form.classType === editor.item.class_type && form.lines.length === editor.lines.length
        && form.lines.every((line, index) => {
          const original = editor.lines[index];
          return line.courseId === original.course_id && line.amountStudent === Number(original.amount_student)
            && line.pricePerPax === Number(original.price) && line.location === original.location;
        });
      // A status-only change must not regenerate or email the quotation.
      const statusOnly = contentUnchanged && form.status !== "WAITING";
      const saved = statusOnly ? { item: { id: editor!.item.id } } : await api<{ item: { id: string } }>(
        created ? "/api/v1/internal/quotations" : `/api/v1/internal/quotations/${editor!.item.id}`,
        { method: created ? "POST" : "PUT", body }
      );
      // Sending the quotation already sets WAITING on the server.
      if (!created && form.status !== "WAITING") {
        await api(`/api/v1/internal/quotations/${saved.item.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: form.status }),
        });
      }
      showToast(created
        ? "Quotation created successfully."
        : previousStatus !== form.status
          ? `Quotation status changed to ${statusLabel(form.status)} successfully.`
          : "Quotation updated successfully.");
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
  const resend = async (quote: Quote) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/internal/quotations/${quote.id}/resend`, { method: "POST" });
      showToast("Quotation resent successfully.");
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
      showToast("Quotation deleted successfully.");
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
  const field =
    "h-9 w-full rounded-full border border-zinc-950/60 bg-neutral-50 px-3 text-sm text-gray-700 outline-none transition-colors duration-150 hover:border-rose-600 focus:border-rose-600 focus:ring-2 focus:ring-rose-100";
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
          <AddButton onClick={() => openEditor()}>
            Add Quotation
          </AddButton>
        </section>
        <section className="rounded-3xl border border-rose-50 bg-white p-5">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <Input
              label="Search Quotation"
              leftIcon="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Example: QTN-000001"
              containerClassName="w-full md:w-60"
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Dropdown
                label="Course"
                value={courseFilter}
                onChange={(val) => {
                  setPage(1);
                  setCourseFilter(val);
                }}
                options={[
                  { label: "All Course", value: "ALL" },
                  ...courses.map((c) => ({ label: c.name, value: c.id })),
                ]}
                containerClassName="w-full sm:w-44"
              />
              <Dropdown
                label="Status"
                value={statusFilter}
                onChange={(val) => {
                  setPage(1);
                  setStatusFilter(val);
                }}
                options={[
                  { label: "All Status", value: "ALL" },
                  { label: "Waiting", value: "WAITING" },
                  { label: "Approved", value: "APPROVED" },
                  { label: "Cancelled", value: "CANCELLED" },
                  { label: "Revision", value: "REVISION" },
                  { label: "Send failed", value: "SEND_FAILED" },
                ]}
                containerClassName="w-full sm:w-40"
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {!loading && result.items.length === 0 ? (
            <EmptyState
              description="No Quotations Found"
              onAdd={() => openEditor()}
              addLabel="Add Quotation"
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-[#E9E9E9]">
            <table className="table-fixed w-full min-w-[960px] text-left text-sm">
              <thead className="bg-neutral-100 text-sm font-normal text-zinc-950/60 border-b border-[#E9E9E9]">
                <tr>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">No.</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Account</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Requested Course</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Type</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Students</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Amount</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Status</th>
                  <th className="w-28 whitespace-nowrap px-3 py-3 font-normal text-zinc-950/60 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((quote) => (
                  <tr key={quote.id} className="border-t border-[#E9E9E9] text-zinc-700 transition-colors hover:bg-neutral-50/50">
                    <td className="px-3 py-3">
                      <button
                        className="font-medium text-rose-600 hover:underline"
                        onClick={() => void showDetails(quote)}
                      >
                        {quote.quotation_code}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div>
                        {quote.account_name}
                        <div className="text-xs text-zinc-500">PIC: {quote.pic_name}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{quote.course_count} course(s)</td>
                    <td className="px-3 py-3">{typeLabel(quote.class_type)}</td>
                    <td className="px-3 py-3">{Number(quote.students || 0)}</td>
                    <td className="px-3 py-3">{money(Number(quote.amount))}</td>
                    <td className="px-3 py-3">
                      <Badge variant={statusVariant(quote.status)} showDot>
                        {statusLabel(quote.status)}
                      </Badge>
                    </td>
                    <td className="w-28 whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1">
                        <IconButton
                          label="View"
                          icon="eye"
                          size="sm"
                          onClick={() => void showDetails(quote)}
                        />
                        <IconButton
                          label="Edit and resend"
                          icon="pencil-line"
                          size="sm"
                          onClick={() => void openEditor(quote)}
                        />
                        <IconButton
                          label="Delete"
                          icon="trash"
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleting(quote)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-zinc-500">
                      Loading quotations…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 w-full">
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))}
              pageSize={result.items.length}
              totalItems={result.total}
              onPageChange={setPage}
            />
          </div>
            </>
          )}
        </section>
      </div>

      <Modal
        open={editor !== undefined}
        onClose={() => !busy && setEditor(undefined)}
        className="max-h-[92vh] !max-w-[680px] overflow-y-auto"
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
                icon="x"
                onClick={() => setEditor(undefined)}
              />
            </div>
            <Dropdown
              label="Class / Course Type"
              required
              value={form.classType}
              onChange={(val) =>
                setForm((v) => ({ ...v, classType: val as (typeof TYPES)[number] }))
              }
              options={TYPES.map((type) => ({ label: typeLabel(type), value: type }))}
            />
            <div className="h-px w-full bg-zinc-950/20" />
            <Input
              label="Quotation Code"
              required
              maxLength={30}
              value={form.quotationCode}
              onChange={(e) => setForm((v) => ({ ...v, quotationCode: e.target.value }))}
              placeholder="Example: QTN-1234-13"
            />
            <Dropdown
              label="Account"
              required
              searchable
              value={form.accountId}
              placeholder="Pick an active Account"
              onChange={(val) => setForm((v) => ({ ...v, accountId: val, picId: "" }))}
              options={accounts.map((a) => ({ label: a.name, value: a.id }))}
            />
            <Dropdown
              label="Person in Charge"
              required
              disabled={!form.accountId}
              value={form.picId}
              placeholder="Pick an active PIC"
              onChange={(val) => setForm((v) => ({ ...v, picId: val }))}
              options={pics.map((p) => ({ label: `${p.name} · ${p.email}`, value: p.id }))}
            />
            {editor ? (
              <Dropdown
                label="Current Status"
                required
                value={form.status}
                onChange={(val) => setForm((current) => ({ ...current, status: val as typeof current.status }))}
                options={[
                  { label: "Waiting", value: "WAITING" },
                  { label: "Approved", value: "APPROVED" },
                  { label: "Cancelled", value: "CANCELLED" },
                  { label: "Revision", value: "REVISION" },
                ]}
              />
            ) : (
              <Input
                label="Current Status"
                value="Waiting after successful email"
                readOnly
                disabled
              />
            )}
            <div className="h-px w-full bg-zinc-950/20" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-rose-600">Quotation Details</h3>
              <Button
                size="sm"
                type="button"
                leftIcon="plus"
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
              <div key={index} className="flex flex-col gap-4">
                {form.lines.length > 1 && (
                  <div className="flex items-center justify-between text-xs font-medium text-rose-600">
                    Course {index + 1}
                    {index > 0 && (
                      <IconButton
                        size="sm"
                        variant="ghost-red"
                        icon="x"
                        label="Remove course"
                        onClick={() =>
                          setForm((v) => ({ ...v, lines: v.lines.filter((_, i) => i !== index) }))
                        }
                      />
                    )}
                  </div>
                )}
                <Dropdown
                  label="Requested Course"
                  required
                  searchable
                  value={line.courseId}
                  placeholder="Courses Name - Days"
                  onChange={(val) => patchLine(index, { courseId: val })}
                  options={courses.map((c) => ({
                    label: `${c.name} - ${Math.max(1, Math.ceil(c.duration_minutes / 480))} day(s)`,
                    value: c.id,
                  }))}
                />
                <Input
                  label="Amount Student (Pax)"
                  required
                  type="number"
                  min="1"
                  value={line.amountStudent}
                  onChange={(e) => patchLine(index, { amountStudent: Number(e.target.value) })}
                />
                <Input
                  label="Value Amount Per Pax (Rp)"
                  required
                  type="number"
                  min="1"
                  step="any"
                  value={line.pricePerPax || ""}
                  placeholder="50.000"
                  onChange={(e) => patchLine(index, { pricePerPax: Number(e.target.value) })}
                />
                <Input
                  label="Location"
                  required
                  value={line.location}
                  onChange={(e) => patchLine(index, { location: e.target.value })}
                  placeholder="Jakarta, ABC Tower"
                />
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
                leftIcon={editor ? "pencil-line" : "plus"}
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
