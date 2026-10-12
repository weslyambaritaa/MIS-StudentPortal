"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Download, Search } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useAdminApi } from "@/hooks/use-admin-api";

type AccessLog = {
  id: string;
  occurred_at: string;
  actor_subject: string | null;
  actor_type: string;
  active_role: string | null;
  event_type: string;
  object_type: string | null;
  object_id: string | null;
  ip_address: string | null;
  source_system: string;
  outcome: "SUCCESS" | "FAILURE" | "UNKNOWN";
};

type AccessLogResponse = { items: AccessLog[]; page: number; total: number; totalPages: number };
type Filters = { eventType: string; actorSubject: string; outcome: string; from: string; to: string; storage: "active" | "archive" };
const defaultFilters: Filters = { eventType: "", actorSubject: "", outcome: "", from: "", to: "", storage: "active" };

function toQuery(filters: Filters, page: number, format?: "csv") {
  const params = new URLSearchParams({ storage: filters.storage, page: String(page), pageSize: "25" });
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.actorSubject) params.set("actorSubject", filters.actorSubject);
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.from) params.set("from", new Date(filters.from).toISOString());
  if (filters.to) params.set("to", new Date(filters.to).toISOString());
  if (format) params.set("format", format);
  return params;
}

export default function AccessLogsPage() {
  const adminRequest = useAdminApi();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AccessLogResponse>({ items: [], page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async (currentPage: number, currentFilters: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminRequest(`/api/v1/admin/access-logs?${toQuery(currentFilters, currentPage)}`);
      if (!response.ok) throw new Error(`Gagal memuat access log (${response.status})`);
      setResult(await response.json() as AccessLogResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat access log");
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  useEffect(() => { void loadLogs(page, appliedFilters); }, [appliedFilters, loadLogs, page]);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const exportCsv = async () => {
    setError(null);
    try {
      const response = await adminRequest(`/api/v1/admin/access-logs?${toQuery(appliedFilters, 1, "csv")}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `Ekspor gagal (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `access-logs-${appliedFilters.storage}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ekspor gagal");
    }
  };

  return (
    <AppShell title="Access Logs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-950">Access Logs</h1>
          <p className="mt-1 text-sm text-zinc-600">Riwayat login dan perubahan akses dari Keycloak.</p>
        </div>
        <Button onClick={() => void exportCsv()} leftIcon={<Download size={16} />} disabled={loading}>
          Export CSV
        </Button>
      </div>

      <form onSubmit={submitFilters} className="mt-6 grid gap-3 rounded-3xl border border-rose-50 bg-white p-5 md:grid-cols-3 xl:grid-cols-6">
        <label className="text-sm text-gray-600">Penyimpanan
          <select value={filters.storage} onChange={(event) => setFilters({ ...filters, storage: event.target.value as Filters["storage"] })} className="mt-1 h-10 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-gray-800">
            <option value="active">Aktif (≤ 12 bulan)</option><option value="archive">Arsip (&gt; 12 bulan)</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">Jenis kejadian
          <input value={filters.eventType} onChange={(event) => setFilters({ ...filters, eventType: event.target.value })} maxLength={100} className="mt-1 h-10 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-gray-800" placeholder="LOGIN, UPDATE…" />
        </label>
        <label className="text-sm text-gray-600">Subjek pelaku
          <input value={filters.actorSubject} onChange={(event) => setFilters({ ...filters, actorSubject: event.target.value })} maxLength={255} className="mt-1 h-10 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-gray-800" placeholder="Keycloak subject" />
        </label>
        <label className="text-sm text-gray-600">Hasil
          <select value={filters.outcome} onChange={(event) => setFilters({ ...filters, outcome: event.target.value })} className="mt-1 h-10 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-gray-800">
            <option value="">Semua</option><option value="SUCCESS">Berhasil</option><option value="FAILURE">Gagal</option><option value="UNKNOWN">Tidak diketahui</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">Dari
          <input type="datetime-local" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="mt-1 h-10 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-gray-800" />
        </label>
        <label className="text-sm text-gray-600">Sampai
          <input type="datetime-local" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="mt-1 h-10 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-gray-800" />
        </label>
        <div className="flex items-end md:col-span-3 xl:col-span-6">
          <Button type="submit" leftIcon={<Search size={16} />} disabled={loading}>Terapkan filter</Button>
        </div>
      </form>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="mt-5 overflow-x-auto rounded-3xl border border-rose-50 bg-white">
        <div className="flex items-center justify-between px-5 py-4 text-sm text-zinc-600">
          <span>{loading ? "Memuat…" : `${result.total} kejadian`}</span>
          <span>{appliedFilters.storage === "active" ? "Database aktif" : "Tabel arsip"}</span>
        </div>
        <table className="w-full min-w-[950px] border-collapse text-left text-sm">
          <thead className="bg-neutral-100 text-xs font-medium uppercase text-gray-600">
            <tr>{["Waktu", "Pelaku", "Kejadian", "Objek", "IP address", "Sumber", "Hasil"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {!loading && result.items.length === 0 && <tr><td className="px-4 py-8 text-center text-zinc-500" colSpan={7}>Tidak ada log untuk filter ini.</td></tr>}
            {result.items.map((row) => (
              <tr key={row.id} className="border-t border-rose-50 text-zinc-700">
                <td className="whitespace-nowrap px-4 py-3">{new Date(row.occurred_at).toLocaleString("id-ID")}</td>
                <td className="max-w-48 truncate px-4 py-3" title={row.actor_subject ?? "-"}>{row.actor_subject ?? "-"}<span className="block text-xs text-zinc-400">{row.actor_type}{row.active_role ? ` · ${row.active_role}` : ""}</span></td>
                <td className="px-4 py-3 font-medium">{row.event_type}</td>
                <td className="max-w-48 truncate px-4 py-3">{row.object_type ?? "-"}{row.object_id ? ` · ${row.object_id}` : ""}</td>
                <td className="px-4 py-3">{row.ip_address ?? "-"}</td>
                <td className="px-4 py-3">{row.source_system}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs ${row.outcome === "SUCCESS" ? "bg-green-100 text-green-700" : row.outcome === "FAILURE" ? "bg-red-100 text-red-700" : "bg-neutral-100 text-zinc-600"}`}>{row.outcome}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-rose-50 px-5 py-4 text-sm">
          <span className="text-zinc-600">Halaman {result.page} dari {Math.max(result.totalPages, 1)}</span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button>
            <Button variant="ghost" disabled={loading || page >= result.totalPages} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
