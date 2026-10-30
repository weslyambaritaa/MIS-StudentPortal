"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Eye, Pencil, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@mis/ui/badge";
import { Button, AddButton } from "@mis/ui/button";
import { DataTable, type DataTableColumn } from "@mis/ui/data-table";
import { DeleteConfirmationModal } from "@mis/ui/delete-confirmation-modal";
import { IconButton } from "@mis/ui/icon-button";
import { Pagination } from "@mis/ui/pagination";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@mis/ui/toast";
import { TrainerDetailsDialog } from "./dialog/trainer-details-dialog";
import { TrainerDialog, type TrainerSubmitValue, type TrainerValue } from "./dialog/trainer-dialog";
import { TrainerBookingDialog } from "./dialog/trainer-booking-dialog";

type TrainerPage = { items: TrainerValue[]; page: number; pageSize: number; total: number };
type Training = { id: string; name: string; status: string; assigned_at: string };
const EMPTY: TrainerPage = { items: [], page: 1, pageSize: 8, total: 0 };
const badge = (status: TrainerValue["status"]) => status === "ACTIVE" ? <Badge variant="success" showDot>Active</Badge> : status === "PENDING" ? <Badge variant="warning" showDot>Pending</Badge> : <Badge variant="danger" showDot>Inactive</Badge>;

export default function TrainersPage() {
  const api = useApi();
  const { showToast } = useToast();
  const [result, setResult] = useState<TrainerPage>(EMPTY);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editor, setEditor] = useState<TrainerValue | null | undefined>(undefined);
  const [selected, setSelected] = useState<TrainerValue | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deleting, setDeleting] = useState<TrainerValue | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "8", status });
      if (search) query.set("search", search);
      if (specialization !== "ALL") query.set("specialization", specialization);
      setResult(await api<TrainerPage>(`/api/v1/internal/trainers?${query}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load Trainers"); }
    finally { setLoading(false); }
  }, [api, page, search, specialization, status]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setSearch(searchDraft.trim()); }, 250); return () => window.clearTimeout(timer); }, [searchDraft]);
  useEffect(() => { void api<{ items: string[] }>("/api/v1/internal/trainers/specializations").then((response) => setSpecializations(response.items)).catch(() => undefined); }, [api]);

  const openDetails = async (trainer: TrainerValue) => {
    setSelected(trainer); setTrainings([]); setDetailsLoading(true);
    try { const response = await api<{ item: TrainerValue; trainings: Training[] }>(`/api/v1/internal/trainers/${trainer.id}`); setSelected(response.item); setTrainings(response.trainings); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load Trainer details"); }
    finally { setDetailsLoading(false); }
  };
  const save = async (payload: TrainerSubmitValue) => {
    setBusy(true); setDialogError(null);
    try {
      const id = editor?.id;
      await api(`/api/v1/internal/trainers${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
      showToast(id ? "Trainer updated successfully." : "Trainer added successfully.");
      setEditor(undefined); setSelected(null); await load();
      void api<{ items: string[] }>("/api/v1/internal/trainers/specializations").then((response) => setSpecializations(response.items));
    } catch (cause) { setDialogError(cause instanceof Error ? cause.message : "Failed to save Trainer"); }
    finally { setBusy(false); }
  };
  const deleteTrainer = async () => {
    if (!deleting) return;
    setBusy(true); setError(null);
    try {
      await api(`/api/v1/internal/trainers/${deleting.id}`, { method: "DELETE" });
      showToast("Trainer and portal account deleted successfully.");
      setDeleting(null); setSelected(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to delete Trainer"); setDeleting(null); }
    finally { setBusy(false); }
  };
  const resendActivation = async (trainer: TrainerValue) => {
    setBusy(true); setError(null);
    try {
      const response = await api<{ expiresAt: string }>(`/api/v1/internal/trainers/${trainer.id}/resend-activation`, { method: "POST" });
      showToast("Trainer activation email resent successfully.");
      setSelected((current) => current?.id === trainer.id ? { ...current, activation_expires_at: response.expiresAt } : current);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to resend activation email"); }
    finally { setBusy(false); }
  };
  const columns: DataTableColumn<TrainerValue>[] = [
    { key: "name", header: "Trainer Name", render: (row) => <button className="text-left font-medium text-rose-600 hover:underline" onClick={() => void openDetails(row)}>{row.name || "Legacy trainer profile"}<span className="block text-xs font-normal text-zinc-500">{row.trainer_code || "—"} · {row.email || "—"}</span></button> },
    { key: "specialty", header: "Speciality", render: (row) => row.specialization },
    { key: "certification", header: "Certification", render: (row) => <div className="flex max-w-xs flex-wrap gap-1">{row.certifications.slice(0, 2).map((certificate) => { const days = Number(certificate.days_until_expiry); const expired = Number.isFinite(days) && days < 0; const soon = Number.isFinite(days) && days >= 0 && days <= 60; return <span key={certificate.id} title={certificate.name} className={`rounded-full px-2 py-1 text-xs ${expired ? "bg-red-100 text-red-700" : soon ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{certificate.name}{expired ? " · Expired" : soon ? ` · ${days}d` : ""}</span>; })}{row.certifications.length > 2 && <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-gray-600">+{row.certifications.length - 2}</span>}{row.certifications.length === 0 && <span className="text-zinc-400">—</span>}</div> },
    { key: "yearly-class", header: "Yearly Class", render: (row) => row.yearly_class_count },
    { key: "rating", header: "Rating", render: (row) => row.rating == null ? "—" : `${row.rating.toFixed(1)} / 5` },
    { key: "status", header: "Status", render: (row) => badge(row.status) },
    { key: "action", header: "Action", className: "whitespace-nowrap", render: (row) => <div className="flex items-center gap-1"><IconButton label={`View ${row.name}`} icon={<Eye size={17} />} size="sm" onClick={() => void openDetails(row)} /><IconButton label={`Edit ${row.name}`} icon={<Pencil size={17} />} size="sm" onClick={() => { setDialogError(null); setEditor(row); }} /><IconButton label={row.training_history_count > 0 ? `Cannot delete ${row.name}: has training history` : `Delete ${row.name}`} icon={<Trash2 size={17} />} variant="danger" size="sm" disabled={row.training_history_count > 0} onClick={() => setDeleting(row)} /></div> },
  ];

  return <AppShell title="Master Data | Trainer"><div className="flex flex-col gap-6">
    <section className="flex flex-col justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-medium text-gray-600">Trainer</h1><p className="mt-1 text-sm text-zinc-600">Manage trainer profiles, portal access, training history, and certification expiry.</p></div><div className="flex flex-wrap items-center gap-3"><Button variant="ghost" className="text-rose-600 hover:bg-transparent hover:text-rose-600" leftIcon={<CalendarPlus size={18}/>} onClick={() => setBookingOpen(true)}>Book Trainer</Button><AddButton onClick={() => { setDialogError(null); setEditor(null); }}>Add Trainer</AddButton></div></section>
    <section className="rounded-3xl border border-rose-50 bg-white p-5"><div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 xl:w-64">Search Trainer Name<span className="flex h-9 items-center gap-2 rounded-full border border-rose-600 bg-neutral-50 px-3"><Search size={20} className="shrink-0 text-slate-900/40"/><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Name, code, or email" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-900/40"/></span></label>
      <div className="flex flex-col gap-4 sm:flex-row"><label className="flex flex-col gap-[3px] text-sm text-gray-600">Speciality<select value={specialization} onChange={(event) => { setPage(1); setSpecialization(event.target.value); }} className="h-9 w-52 rounded-full border border-rose-600 bg-neutral-50 px-3"><option value="ALL">All Speciality</option>{specializations.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="flex flex-col gap-[3px] text-sm text-gray-600">Status<select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="h-9 w-40 rounded-full border border-rose-600 bg-neutral-50 px-3"><option value="ALL">All Status</option><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <div className="py-10 text-center text-zinc-500">Loading Trainers…</div> : <DataTable columns={columns} rows={result.items} getRowKey={(row) => row.id} caption="Trainer profiles" emptyMessage="No Trainers found."/>}
    <div className="mt-1"><Pagination page={page} totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))} pageSize={result.items.length} totalItems={result.total} onPageChange={setPage}/></div>
    </section></div>
    {editor !== undefined && <TrainerDialog value={editor} busy={busy} error={dialogError} onClose={() => setEditor(undefined)} onSubmit={save}/>}
    {bookingOpen && <TrainerBookingDialog api={api} onClose={() => setBookingOpen(false)} onBooked={() => { setBookingOpen(false); showToast("Trainer booked successfully for the selected date."); }} />}
    {selected && <TrainerDetailsDialog trainer={selected} trainings={trainings} loading={detailsLoading} onClose={() => setSelected(null)} onEdit={() => { setDialogError(null); setEditor(selected); setSelected(null); }} onDelete={() => { setDeleting(selected); setSelected(null); }} onResendActivation={() => void resendActivation(selected)}/>}
    <DeleteConfirmationModal open={Boolean(deleting)} itemName={deleting?.name ?? ""} description={`Permanently delete Trainer “${deleting?.name ?? ""}”, all profile and certification data, and the associated portal account? This is allowed only when the Trainer has never had a Training assignment.`} onClose={() => !busy && setDeleting(null)} onConfirm={() => void deleteTrainer()} loading={busy}/>
  </AppShell>;
}
