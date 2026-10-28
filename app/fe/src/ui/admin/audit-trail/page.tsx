"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { BUSINESS_ROLES, type BusinessRole } from "@mis/shared-types";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@mis/ui/button";
import { Pagination } from "@mis/ui/pagination";
import { useApi } from "@/hooks/use-api";
import { AuditDetailDialog, type AuditDetail } from "./dialog/audit-detail-dialog";

type AuditEntry = AuditDetail & { id: string; actor_subject: string | null; storage: "active" | "archive" };
type AuditResponse = { items: AuditEntry[]; page: number; pageSize: number; total: number };
type Filters = { role: string; from: string; to: string };
const emptyFilters: Filters = { role: "", from: "", to: "" };

function toQuery(filters: Filters, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: "8" });
  if (filters.role) params.set("role", filters.role);
  if (filters.from) params.set("from", new Date(filters.from).toISOString());
  if (filters.to) params.set("to", new Date(filters.to).toISOString());
  return params;
}

function summary(entry: AuditEntry) {
  const fields = [...new Set([...Object.keys(parse(entry.data_before)), ...Object.keys(parse(entry.data_after))])];
  const changeText = fields.length ? fields.join(", ") : entry.process_name ?? entry.action;
  return entry.ip_address ? `${changeText} · IP ${entry.ip_address}` : changeText;
}

function parse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

export default function AuditTrailPage() {
  const api = useApi();
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditResponse>({ items: [], page: 1, pageSize: 8, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api<AuditResponse>(`/api/v1/internal/audit-trail?${toQuery(appliedFilters, page)}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat Audit Trail");
    } finally { setLoading(false); }
  }, [api, appliedFilters, page]);

  useEffect(() => { void load(); }, [load]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  return (
    <AppShell title="Document & System | Audit Trail">
      <div className="flex flex-col gap-6">
        <section className="rounded-3xl border border-rose-50 bg-white p-5">
          <h1 className="text-3xl font-medium text-gray-600">Audit Trail</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">Telusuri perubahan data di dalam sistem, termasuk siapa yang melakukan perubahan, apa yang berubah, dan kapan perubahan terjadi.</p>
        </section>

        <section className="rounded-3xl border border-rose-50 bg-white p-5">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <h2 className="text-2xl font-medium text-rose-600">Activity Within the System</h2>
            <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-gray-600">User Role
                <select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })} className="mt-1 h-9 w-full rounded-full border border-rose-100 bg-neutral-50 px-3">
                  <option value="">All Role</option>
                  {BUSINESS_ROLES.map((role: BusinessRole) => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}
                </select>
              </label>
              <label className="text-sm text-gray-600">Date / Time from
                <input type="datetime-local" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="mt-1 h-9 w-full rounded-full border border-rose-100 bg-neutral-50 px-3" />
              </label>
              <label className="text-sm text-gray-600">Date / Time to
                <input type="datetime-local" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="mt-1 h-9 w-full rounded-full border border-rose-100 bg-neutral-50 px-3" />
              </label>
              <div className="sm:col-span-3 sm:flex sm:justify-end"><Button type="submit" leftIcon={<Search size={16} />} disabled={loading}>Apply Filter</Button></div>
            </form>
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-5 overflow-x-auto rounded-xl border border-rose-50">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-neutral-100 text-xs font-medium uppercase text-gray-600"><tr>{["Time", "User", "Action", "Object", "Detail"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
              <tbody>
                {!loading && result.items.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-zinc-500">Tidak ada aktivitas untuk filter ini.</td></tr>}
                {result.items.map((entry) => (
                  <tr key={entry.id} className="border-t border-rose-50 text-zinc-700">
                    <td className="whitespace-nowrap px-3 py-3">{new Date(entry.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-3"><span className="font-medium">{entry.actor_name ?? entry.actor_subject ?? entry.process_name ?? "System"}</span><span className={`ml-2 inline-flex rounded-full border px-3 py-1 text-xs ${entry.actor_type === "SYSTEM" ? "border-amber-300 bg-amber-100 text-amber-700" : "border-blue-400 bg-blue-100 text-blue-700"}`}>{entry.active_role ?? (entry.actor_type === "SYSTEM" ? "QPD" : "—")}</span></td>
                    <td className="px-3 py-3 font-medium">{entry.action}</td>
                    <td className="px-3 py-3">{entry.object_type}{entry.object_id ? ` / ${entry.object_id}` : ""}</td>
                    <td className="max-w-80 px-3 py-3"><button type="button" className="text-left text-rose-700 underline-offset-2 hover:underline" onClick={() => setSelected(entry)}>{summary(entry)}</button></td>
                  </tr>
                ))}
                {loading && <tr><td colSpan={5} className="px-3 py-10 text-center text-zinc-500">Memuat aktivitas…</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
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
      {selected && <AuditDetailDialog entry={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}
