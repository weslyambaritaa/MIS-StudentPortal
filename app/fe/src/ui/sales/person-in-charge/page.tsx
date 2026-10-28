"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Eye, Mail, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { DataTable, type DataTableColumn } from "@mis/ui/data-table";
import { DeleteConfirmationModal } from "@mis/ui/delete-confirmation-modal";
import { IconButton } from "@mis/ui/icon-button";
import { Pagination } from "@mis/ui/pagination";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@mis/ui/toast";
import { PicDetailsDialog, type PicStudent } from "./dialog/pic-details-dialog";
import { PicDialog, type PicAccountOption, type PicValue } from "./dialog/pic-dialog";

type PicPage = { items: PicValue[]; page: number; pageSize: number; total: number };
const EMPTY: PicPage = { items: [], page: 1, pageSize: 8, total: 0 };
const statusLabel = (status: PicValue["status"]) => status === "PENDING" ? "Pending" : status === "ACTIVE" ? "Active" : "Inactive";

export default function PersonInChargePage() {
  const api = useApi();
  const { showToast } = useToast();
  const [result, setResult] = useState<PicPage>(EMPTY);
  const [accounts, setAccounts] = useState<PicAccountOption[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editor, setEditor] = useState<PicValue | null | undefined>(undefined);
  const [selected, setSelected] = useState<PicValue | null>(null);
  const [students, setStudents] = useState<PicStudent[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deleting, setDeleting] = useState<PicValue | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "8", status });
      if (search) query.set("search", search);
      if (accountId !== "ALL") query.set("accountId", accountId);
      setResult(await api<PicPage>(`/api/v1/internal/pics?${query}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load PICs"); }
    finally { setLoading(false); }
  }, [api, accountId, page, search, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setSearch(searchDraft.trim()); }, 250); return () => window.clearTimeout(timer); }, [searchDraft]);
  useEffect(() => { void api<{ items: PicAccountOption[] }>("/api/v1/internal/pics/accounts").then((response) => setAccounts(response.items)).catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load Account options")); }, [api]);

  const openDetails = async (pic: PicValue) => {
    setSelected(pic); setStudents([]); setDetailsLoading(true);
    try { const response = await api<{ item: PicValue; students: PicStudent[] }>(`/api/v1/internal/pics/${pic.id}`); setSelected(response.item); setStudents(response.students); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load PIC details"); }
    finally { setDetailsLoading(false); }
  };

  const save = async (value: { name: string; email: string; accountId?: string; status?: "ACTIVE" | "INACTIVE" }) => {
    setBusy(true); setDialogError(null);
    try {
      if (editor?.id) await api(`/api/v1/internal/pics/${editor.id}`, { method: "PUT", body: JSON.stringify({ name: value.name, status: value.status }) });
      else await api("/api/v1/internal/pics", { method: "POST", body: JSON.stringify(value) });
      showToast(editor?.id ? "PIC updated successfully." : "PIC added successfully.");
      setEditor(undefined); setSelected(null); await load();
    } catch (cause) { setDialogError(cause instanceof Error ? cause.message : "Failed to save PIC"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting?.id) return;
    setBusy(true); setError(null);
    try { await api(`/api/v1/internal/pics/${deleting.id}`, { method: "DELETE" }); showToast("PIC deleted successfully."); setDeleting(null); setSelected(null); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to delete PIC"); setDeleting(null); }
    finally { setBusy(false); }
  };

  const resendActivation = async (pic: PicValue) => {
    if (!pic.id) return;
    setBusy(true); setError(null);
    try { await api(`/api/v1/internal/pics/${pic.id}/resend-activation`, { method: "POST" }); showToast("PIC activation email resent successfully."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to resend activation email"); }
    finally { setBusy(false); }
  };

  const columns: DataTableColumn<PicValue>[] = [
    { key: "name", header: "Name", render: (row) => <button className="text-left font-medium text-rose-600 hover:underline" onClick={() => void openDetails(row)}>{row.name}</button> },
    { key: "account", header: "Account", render: (row) => row.account_name },
    { key: "email", header: "Email", render: (row) => row.email },
    { key: "status", header: "Status", render: (row) => <Badge variant={row.status === "ACTIVE" ? "success" : row.status === "PENDING" ? "warning" : "danger"} showDot>{statusLabel(row.status)}</Badge> },
    { key: "action", header: "Action", className: "whitespace-nowrap", render: (row) => <div className="flex items-center gap-1"><IconButton label={`View ${row.name}`} icon={<Eye size={17}/>} size="sm" onClick={() => void openDetails(row)}/>{row.status === "PENDING" && <IconButton label={`Resend activation to ${row.email}`} icon={<Mail size={17}/>} size="sm" disabled={busy || Boolean(row.activation_expires_at && new Date(row.activation_expires_at).getTime() > Date.now())} onClick={() => void resendActivation(row)}/>}<IconButton label={`Edit ${row.name}`} icon={<Pencil size={17}/>} size="sm" onClick={() => setEditor(row)}/><IconButton label={`Delete ${row.name}`} icon={<Trash2 size={17}/>} variant="danger" size="sm" onClick={() => setDeleting(row)}/></div> },
  ];

  return <AppShell title="Manage | PIC List"><div className="flex flex-col gap-6">
    <section className="flex flex-col justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-medium text-gray-600">Person In Charge</h1><p className="mt-1 text-sm text-zinc-600">PIC monitors training for employees in an Account without attending the classes.</p></div><Button leftIcon={<Plus size={18}/>} onClick={() => { setDialogError(null); setEditor(null); }}>Add PIC</Button></section>
    <section className="rounded-3xl border border-rose-50 bg-white p-5"><div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <label htmlFor="pic-search" className="flex w-full flex-col gap-[3px] text-sm text-gray-600 xl:w-60">Search PIC Name<span className="flex h-9 items-center gap-2 rounded-full border border-rose-600 bg-neutral-50 px-3"><Search size={20} className="shrink-0 text-slate-900/40"/><input id="pic-search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search PIC name or email" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-900/40"/></span></label>
      <div className="flex flex-col gap-4 sm:flex-row"><label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 sm:w-44">Account<span className="relative block"><select value={accountId} onChange={(event) => { setPage(1); setAccountId(event.target.value); }} className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-sm"><option value="ALL">All Account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600"/></span></label>
        <label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 sm:w-44">Status<span className="relative block"><select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-sm"><option value="ALL">All Status</option><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600"/></span></label></div>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <div className="py-10 text-center text-zinc-500">Loading PICsÃ¢â‚¬Â¦</div> : <DataTable columns={columns} rows={result.items} getRowKey={(row) => row.id ?? row.email} caption="Person In Charge records assigned to current Sales user" emptyMessage="No PICs found."/>}
    <div className="mt-1"><Pagination page={page} totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))} pageSize={result.items.length} totalItems={result.total} onPageChange={setPage}/></div>
    </section></div>
    {editor !== undefined && <PicDialog value={editor} accounts={accounts} busy={busy} error={dialogError} onClose={() => { setEditor(undefined); setDialogError(null); }} onSubmit={save}/>}
    {selected && <PicDetailsDialog item={selected} students={students} loading={detailsLoading} onClose={() => setSelected(null)} onEdit={() => { setDialogError(null); setEditor(selected); setSelected(null); }} onDelete={() => setDeleting(selected)}/>}
    <DeleteConfirmationModal open={Boolean(deleting)} itemName={deleting?.name ?? ""} description={`PIC Ã¢â‚¬Å“${deleting?.name ?? ""}Ã¢â‚¬Â and its Keycloak account will be permanently deleted. Accounts with another business role must be handled separately. The audit record will be retained.`} onClose={() => setDeleting(null)} onConfirm={() => void remove()} loading={busy}/>
  </AppShell>;
}
