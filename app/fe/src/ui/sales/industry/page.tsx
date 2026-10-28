"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { DeleteConfirmationModal } from "@mis/ui/delete-confirmation-modal";
import { IconButton } from "@mis/ui/icon-button";
import { Pagination } from "@mis/ui/pagination";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@mis/ui/toast";
import { IndustryDialog, type IndustryFormValue } from "./dialog/industry-dialog";

type Industry = IndustryFormValue & { id: string; industry_code: string; amount_account: number | string; ever_used: boolean };
type IndustryList = { items: Industry[]; page: number; pageSize: number; total: number };

export default function IndustryPage() {
  const api = useApi();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<IndustryList>({ items: [], page: 1, pageSize: 8, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<IndustryFormValue | null>(null);
  const [deleting, setDeleting] = useState<Industry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "8", status });
      if (search) query.set("search", search);
      setResult(await api<IndustryList>(`/api/v1/internal/industries?${query}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load industries");
    } finally { setLoading(false); }
  }, [api, page, search, status]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(draftSearch.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [draftSearch]);

  const save = async (value: { name: string; status: "ACTIVE" | "INACTIVE" }) => {
    setBusy(true); setError(null);
    try {
      const id = editor?.id;
      await api(`/api/v1/internal/industries${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST", body: JSON.stringify(value),
      });
      showToast(id ? "Industry updated successfully." : "Industry added successfully.");
      setEditor(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save industry");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError(null);
    try {
      await api(`/api/v1/internal/industries/${deleting.id}`, { method: "DELETE" });
      showToast("Industry deleted successfully.");
      setDeleting(null);
      if (result.items.length === 1 && page > 1) setPage((value) => value - 1);
      else await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to delete industry");
      setDeleting(null);
    } finally { setBusy(false); }
  };

  return (
    <AppShell title="Manage | Industry">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5 sm:flex-row sm:items-center">
          <div><h1 className="text-3xl font-medium text-gray-600">Industry</h1><p className="mt-1 text-sm text-zinc-600">The highest category of account grouping. One industry has many accounts.</p></div>
          <Button leftIcon={<Plus size={18} />} onClick={() => setEditor({ name: "", status: "ACTIVE" })}>Add Industry</Button>
        </section>

        <section className="rounded-3xl border border-rose-50 bg-white p-5">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <label htmlFor="industry-search" className="flex w-full flex-col gap-[3px] text-sm text-gray-600 md:w-60">
              Search Industry
              <span className="flex h-9 items-center gap-2 rounded-full border border-rose-600 bg-neutral-50 px-3">
                <Search size={20} className="shrink-0 text-slate-900/40" />
                <input id="industry-search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Example: Oil & Gas" className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-900/40" />
              </span>
            </label>
            <label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 md:w-44">Status
              <span className="relative block h-9">
                <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-sm text-slate-900/40 outline-none">
                  <option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
                </select>
                <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600" />
              </span>
            </label>
          </div>

          {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="overflow-x-auto rounded-xl border border-rose-50">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-neutral-100 text-xs font-medium uppercase text-gray-600"><tr><th className="px-3 py-3">Code</th><th className="px-3 py-3">Industry Name</th><th className="px-3 py-3">Amount Account</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr></thead>
              <tbody>
                {!loading && result.items.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-zinc-500">No industries found.</td></tr>}
                {result.items.map((industry) => <tr key={industry.id} className="border-t border-rose-50 text-zinc-700">
                  <td className="px-3 py-3 font-medium">{industry.industry_code}</td><td className="px-3 py-3">{industry.name}</td><td className="px-3 py-3">{Number(industry.amount_account)}</td>
                  <td className="px-3 py-3"><Badge variant={industry.status === "ACTIVE" ? "success" : "danger"} showDot>{industry.status === "ACTIVE" ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1"><IconButton label={`Edit ${industry.name}`} icon={<Pencil size={17} />} size="sm" onClick={() => setEditor(industry)} /><IconButton label={industry.ever_used ? "Cannot delete: Industry has been used" : `Delete ${industry.name}`} icon={<Trash2 size={17} />} variant="danger" size="sm" disabled={industry.ever_used} onClick={() => setDeleting(industry)} /></div></td>
                </tr>)}
                {loading && <tr><td colSpan={5} className="px-3 py-10 text-center text-zinc-500">Loading industriesÃ¢â‚¬Â¦</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-4 w-full">
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))}
              pageSize={result.items.length}
              totalItems={result.total}
              onPageChange={(nextPage) => setPage(nextPage)}
            />
          </div>
        </section>
      </div>
      {editor && <IndustryDialog value={editor} busy={busy} onClose={() => setEditor(null)} onSubmit={save} />}
      <DeleteConfirmationModal open={Boolean(deleting)} itemName={deleting?.name ?? ""} description={`Industry Ã¢â‚¬Å“${deleting?.name ?? ""}Ã¢â‚¬Â will be permanently deleted.`} onClose={() => setDeleting(null)} onConfirm={() => void remove()} loading={busy} />
    </AppShell>
  );
}
