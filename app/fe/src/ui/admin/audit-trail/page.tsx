"use client";

import { useCallback, useEffect, useState } from "react";
import { BUSINESS_ROLES, type BusinessRole } from "@mis/shared-types";
import { AppShell } from "@/components/layout/app-shell";
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
  if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59.999`).toISOString());
  return params;
}

function parse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function summary(entry: AuditEntry) {
  const fields = [...new Set([...Object.keys(parse(entry.data_before)), ...Object.keys(parse(entry.data_after))])];
  const changeText = fields.length ? fields.join(", ") : entry.process_name ?? entry.action;
  return entry.ip_address ? `${changeText} · IP ${entry.ip_address}` : changeText;
}

function roleBadgeClass(role: string | null, actorType: string) {
  if (actorType === "SYSTEM" || role === "admin" || role === "management") return "border-amber-300 bg-amber-300/20 text-amber-700";
  if (role === "trainer") return "border-blue-500 bg-blue-500/20 text-blue-600";
  return "border-gray-300 bg-gray-200 text-zinc-700";
}

export default function AuditTrailPage() {
  const api = useApi();
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditResponse>({ items: [], page: 1, pageSize: 8, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api<AuditResponse>(`/api/v1/internal/audit-trail?${toQuery(filters, page)}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Audit Trail");
    } finally { setLoading(false); }
  }, [api, filters, page]);

  useEffect(() => { void load(); }, [load]);

  const updateFilter = (next: Filters) => {
    setPage(1);
    setFilters(next);
  };

  return (
    <AppShell title="Document & System | Audit Trail">
      <div className="flex flex-col gap-6">
        <section className="rounded-3xl border border-rose-50 bg-white p-5">
          <h1 className="text-3xl font-medium text-gray-600">Audit Trail</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-950/60">Track all user activities within the system, including who made changes, what was changed, and when those changes occurred.</p>
        </section>

        <section className="rounded-3xl border border-rose-50 bg-white p-5">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <h2 className="text-2xl font-medium text-rose-600">Activity Within the System</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 sm:w-44">User Role
                <select value={filters.role} onChange={(event) => updateFilter({ ...filters, role: event.target.value })} className="h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-rose-200">
                  <option value="">All Role</option>
                  {BUSINESS_ROLES.map((role: BusinessRole) => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}
                </select>
              </label>
              <label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 sm:w-44">From Date
                <input id="audit-from-date" aria-label="From Date" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => {
                  const from = event.target.value;
                  updateFilter({ ...filters, from, to: filters.to && from && filters.to < from ? from : filters.to });
                }} className="h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-rose-200" />
              </label>
              <label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 sm:w-44">To Date
                <input id="audit-to-date" aria-label="To Date" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => {
                  const to = event.target.value;
                  updateFilter({ ...filters, to, from: filters.from && to && filters.from > to ? to : filters.from });
                }} className="h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-rose-200" />
              </label>
            </div>
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-5 overflow-x-auto rounded-xl border border-rose-50">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-neutral-100 text-xs font-medium text-gray-600">
                <tr>
                  <th scope="col" className="w-40 px-3 py-3">TIME</th>
                  <th scope="col" className="w-56 px-3 py-3">USER</th>
                  <th scope="col" className="w-44 px-3 py-3">ACTION</th>
                  <th scope="col" className="w-72 px-3 py-3">OBJECT</th>
                  <th scope="col" className="px-3 py-3">DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {!loading && result.items.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-zinc-500">No audit activity found.</td></tr>}
                {result.items.map((entry) => (
                  <tr key={entry.id} className="border-t border-rose-50 text-zinc-950/60">
                    <td className="whitespace-nowrap px-3 py-3 font-medium">{new Date(entry.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{entry.actor_name ?? entry.actor_subject ?? entry.process_name ?? "System"}</span>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${roleBadgeClass(entry.active_role, entry.actor_type)}`}>{entry.active_role ?? (entry.actor_type === "SYSTEM" ? "QPD" : "—")}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium">{entry.action}</td>
                    <td className="break-all px-3 py-3">{entry.object_type}{entry.object_id ? ` / ${entry.object_id}` : ""}</td>
                    <td className="max-w-[360px] px-3 py-3">
                      <button type="button" className="text-left font-medium text-zinc-950/60 underline-offset-2 hover:underline" onClick={() => setSelected(entry)}>{summary(entry)}</button>
                    </td>
                  </tr>
                ))}
                {loading && <tr><td colSpan={5} className="px-3 py-10 text-center text-zinc-500">Loading activity...</td></tr>}
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
