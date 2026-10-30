"use client";
import { DropdownSelect } from "@mis/ui/dropdown-select";

import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Search, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@mis/ui/badge";
import { Button, AddButton } from "@mis/ui/button";
import { DataTable, type DataTableColumn } from "@mis/ui/data-table";
import { DeleteConfirmationModal } from "@mis/ui/delete-confirmation-modal";
import { IconButton } from "@mis/ui/icon-button";
import { Modal } from "@mis/ui/modal";
import { Pagination } from "@mis/ui/pagination";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@mis/ui/toast";
import { StudentDetailsDialog } from "./dialog/student-details-dialog";
import { StudentBulkImportDialog } from "./dialog/student-bulk-import-dialog";
import { StudentDialog, type StudentAccountOption, type StudentValue } from "./dialog/student-dialog";

type StudentPage = { items: StudentValue[]; page: number; pageSize: number; total: number };
type Training = { id: string; name: string; status: string; training_type: string };
const EMPTY: StudentPage = { items: [], page: 1, pageSize: 8, total: 0 };
const statusLabel = (status: StudentValue["portal_status"]) => status === "HAVENT_LOGIN" ? "Haven’t Login" : status === "ACTIVE" ? "Active" : "Inactive";
const statusVariant = (status: StudentValue["portal_status"]) => status === "ACTIVE" ? "success" : status === "HAVENT_LOGIN" ? "warning" : "danger";

export default function StudentsPage() {
  const api = useApi();
  const { showToast } = useToast();
  const [result, setResult] = useState<StudentPage>(EMPTY);
  const [accounts, setAccounts] = useState<StudentAccountOption[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editor, setEditor] = useState<StudentValue | null | undefined>(undefined);
  const [selected, setSelected] = useState<StudentValue | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deleting, setDeleting] = useState<StudentValue | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "8", status });
      if (search) query.set("search", search);
      if (accountId !== "ALL") query.set("accountId", accountId);
      setResult(await api<StudentPage>(`/api/v1/internal/students?${query}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load Students"); }
    finally { setLoading(false); }
  }, [api, accountId, page, search, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setSearch(searchDraft.trim()); }, 250); return () => window.clearTimeout(timer); }, [searchDraft]);
  useEffect(() => { void api<{ items: StudentAccountOption[] }>("/api/v1/internal/students/accounts").then((response) => setAccounts(response.items)).catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load Account options")); }, [api]);

  const openDetails = async (student: StudentValue) => {
    setSelected(student); setTrainings([]); setDetailsLoading(true);
    try { const response = await api<{ item: StudentValue; trainings: Training[] }>(`/api/v1/internal/students/${student.id}`); setSelected(response.item); setTrainings(response.trainings); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load Student details"); }
    finally { setDetailsLoading(false); }
  };

  const save = async (value: { name: string; email: string; accountId: string; companyRole: string; portalStatus?: "ACTIVE" | "INACTIVE" }) => {
    setBusy(true); setDialogError(null);
    try {
      if (editor?.id) await api(`/api/v1/internal/students/${editor.id}`, { method: "PUT", body: JSON.stringify({ name: value.name, accountId: value.accountId, companyRole: value.companyRole, portalStatus: value.portalStatus }) });
      else await api("/api/v1/internal/students", { method: "POST", body: JSON.stringify(value) });
      showToast(editor?.id ? "Student updated successfully." : "Student added successfully.");
      setEditor(undefined); setSelected(null); await load();
    } catch (cause) { setDialogError(cause instanceof Error ? cause.message : "Failed to save Student"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting?.id || deleting.class_history_count > 0) return;
    setBusy(true); setError(null);
    try { await api(`/api/v1/internal/students/${deleting.id}`, { method: "DELETE" }); showToast("Student deleted successfully."); setDeleting(null); setSelected(null); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to delete Student"); setDeleting(null); }
    finally { setBusy(false); }
  };

  const resendActivation = async (student: StudentValue) => {
    setBusy(true); setError(null);
    try {
      const response = await api<{ expiresAt: string }>(`/api/v1/internal/students/${student.id}/resend-activation`, { method: "POST" });
      showToast("Student activation email resent successfully.");
      setSelected((current) => current?.id === student.id ? { ...current, activation_expires_at: response.expiresAt } : current);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to resend activation email"); }
    finally { setBusy(false); }
  };

  const columns: DataTableColumn<StudentValue>[] = [
    { key: "name", header: "Name", render: (row) => <button className="text-left font-medium text-rose-600 hover:underline" onClick={() => void openDetails(row)}>{row.name}</button> },
    { key: "account", header: "Account Name", render: (row) => row.account_name },
    { key: "email", header: "Email", render: (row) => row.email },
    { key: "role", header: "Role", render: (row) => row.company_role || <span className="text-zinc-400">—</span> },
    { key: "portal-status", header: "Portal Status", render: (row) => <Badge variant={statusVariant(row.portal_status)} showDot>{statusLabel(row.portal_status)}</Badge> },
    { key: "action", header: "Action", className: "whitespace-nowrap", render: (row) => <div className="flex items-center gap-1"><IconButton label={`View ${row.name}`} icon={<Eye size={17}/>} size="sm" onClick={() => void openDetails(row)}/><IconButton label={`Edit ${row.name}`} icon={<Pencil size={17}/>} size="sm" onClick={() => { setDialogError(null); setEditor(row); }}/><IconButton label={row.class_history_count ? `Cannot delete ${row.name}: has class history` : `Delete ${row.name}`} icon={<Trash2 size={17}/>} variant="danger" size="sm" onClick={() => setDeleting(row)}/></div> },
  ];

  return <AppShell title="Master Data | Student List"><div className="flex flex-col gap-6">
    <section className="flex flex-col justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-medium text-gray-600">Student</h1><p className="mt-1 text-sm text-zinc-600">Manage master data for students and their portal accounts. These records are used when adding Training Participants.</p></div><div className="flex flex-wrap items-center gap-3"><Button variant="navigation" leftIcon={<Upload size={18}/>} onClick={() => setShowBulkImport(true)}>Upload Batch</Button><AddButton onClick={() => { setDialogError(null); setEditor(null); }}>Add Student</AddButton></div></section>
    <section className="rounded-3xl border border-rose-50 bg-white p-5"><div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <label htmlFor="student-search" className="flex w-full flex-col gap-[3px] text-sm text-gray-600 xl:w-60">Search Student<span className="flex h-9 items-center gap-2 rounded-full border border-rose-600 bg-neutral-50 px-3"><Search size={20} className="shrink-0 text-slate-900/40"/><input id="student-search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search name, email, or role" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-900/40"/></span></label>
      <div className="flex flex-col gap-4 sm:flex-row"><label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 sm:w-52">Account Name<span className="relative block"><DropdownSelect value={accountId} onChange={(event) => { setPage(1); setAccountId(event.target.value); }} className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-sm"><option value="ALL">All Account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</DropdownSelect></span></label>
        <label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 sm:w-44">Portal Status<span className="relative block"><DropdownSelect value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-sm"><option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="HAVENT_LOGIN">Haven’t Login</option></DropdownSelect></span></label></div>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <div className="py-10 text-center text-zinc-500">Loading Students…</div> : <DataTable columns={columns} rows={result.items} getRowKey={(row) => row.id} caption="Student master records" emptyMessage="No Students found."/>}
    <div className="mt-1"><Pagination page={page} totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))} pageSize={result.items.length} totalItems={result.total} onPageChange={setPage}/></div>
    </section></div>
    {editor !== undefined && <StudentDialog value={editor} accounts={accounts} busy={busy} error={dialogError} onClose={() => { setEditor(undefined); setDialogError(null); }} onSubmit={save}/>}
    {showBulkImport && <StudentBulkImportDialog api={api} onClose={() => setShowBulkImport(false)} onComplete={() => { void load(); }}/ >}
    {selected && <StudentDetailsDialog student={selected} trainings={trainings} loading={detailsLoading} busy={busy} onClose={() => setSelected(null)} onEdit={() => { setDialogError(null); setEditor(selected); setSelected(null); }} onDelete={() => { setSelected(null); setDeleting(selected); }} onResendActivation={() => void resendActivation(selected)}/>}
    {deleting && deleting.class_history_count > 0 ? <Modal open onClose={() => setDeleting(null)}><h2 className="text-2xl font-medium text-gray-600">Student cannot be deleted</h2><div className="my-4 h-px bg-zinc-950/20"/><p className="text-sm text-zinc-600">{deleting.name} has {deleting.class_history_count} class history record{deleting.class_history_count === 1 ? "" : "s"}. The Student and their class history must remain in the system.</p><div className="mt-6 flex justify-end"><Button onClick={() => setDeleting(null)}>Close</Button></div></Modal> : <DeleteConfirmationModal open={Boolean(deleting)} itemName={deleting?.name ?? ""} description={`Student “${deleting?.name ?? ""}” and its Keycloak account will be permanently deleted. The audit record will be retained.`} onClose={() => setDeleting(null)} onConfirm={() => void remove()} loading={busy}/>}
  </AppShell>;
}
