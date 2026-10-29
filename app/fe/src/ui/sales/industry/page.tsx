"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@mis/ui/badge";
import { Button, AddButton } from "@mis/ui/button";
import { DeleteConfirmationModal } from "@mis/ui/delete-confirmation-modal";
import { Dropdown } from "@mis/ui/dropdown";
import { IconButton } from "@mis/ui/icon-button";
import { Input } from "@mis/ui/input";
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
          <AddButton onClick={() => setEditor({ name: "", status: "ACTIVE" })}>Add Industry</AddButton>
        </section>

        <section className="rounded-3xl border border-rose-50 bg-white p-5">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <Input
              id="industry-search"
              label="Search Industry"
              leftIcon="search"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Example: Oil & Gas"
              containerClassName="w-full md:w-60"
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
                { label: "Active", value: "ACTIVE" },
                { label: "Inactive", value: "INACTIVE" },
              ]}
              containerClassName="w-full md:w-44"
            />
          </div>

          {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="overflow-x-auto rounded-xl border border-[#E9E9E9]">
            <table className="table-fixed w-full min-w-[760px] text-left text-sm">
              <thead className="bg-neutral-100 text-sm font-normal text-zinc-950/60 border-b border-[#E9E9E9]">
                <tr>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Code</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Industry Name</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Amount Account</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Status</th>
                  <th className="w-28 whitespace-nowrap px-3 py-3 font-normal text-zinc-950/60 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {!loading && result.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">
                      No industries found.
                    </td>
                  </tr>
                )}
                {result.items.map((industry) => (
                  <tr key={industry.id} className="border-t border-[#E9E9E9] text-zinc-700 transition-colors hover:bg-neutral-50/50">
                    <td className="px-3 py-3 font-medium text-zinc-900">{industry.industry_code}</td>
                    <td className="px-3 py-3">{industry.name}</td>
                    <td className="px-3 py-3">{Number(industry.amount_account)}</td>
                    <td className="px-3 py-3">
                      <Badge variant={industry.status === "ACTIVE" ? "success" : "danger"} showDot>
                        {industry.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="w-28 whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1">
                        <IconButton
                          label={`Edit ${industry.name}`}
                          icon="pencil-line"
                          size="sm"
                          onClick={() => setEditor(industry)}
                        />
                        <IconButton
                          label={industry.ever_used ? "Cannot delete: Industry has been used" : `Delete ${industry.name}`}
                          icon="trash"
                          variant="danger"
                          size="sm"
                          disabled={industry.ever_used}
                          onClick={() => setDeleting(industry)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">
                      Loading industries…
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
              onPageChange={(nextPage) => setPage(nextPage)}
            />
          </div>
        </section>
      </div>
      {editor && <IndustryDialog value={editor} busy={busy} onClose={() => setEditor(null)} onSubmit={save} />}
      <DeleteConfirmationModal open={Boolean(deleting)} itemName={deleting?.name ?? ""} description={`Industry “${deleting?.name ?? ""}” will be permanently deleted.`} onClose={() => setDeleting(null)} onConfirm={() => void remove()} loading={busy} />
    </AppShell>
  );
}
