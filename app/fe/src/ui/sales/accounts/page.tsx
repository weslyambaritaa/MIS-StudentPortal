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
import { useAuth } from "@/providers/keycloak-provider";
import { useToast } from "@mis/ui/toast";
import { AccountDetailsDialog, type AccountStudent } from "./dialog/account-details-dialog";
import { AccountDialog, type AccountOption, type AccountValue, type SalesOption } from "./dialog/account-dialog";

type AccountRow = AccountValue & { account_type: string; industry_code: string; student_count: number; pic_count: number; pics: string[]; training_count: number };
type PageResult = { items: AccountRow[]; page: number; pageSize: number; total: number };
const EMPTY: PageResult = { items: [], page: 1, pageSize: 8, total: 0 };

export default function AccountsPage() {
  const api = useApi(); const { keycloak } = useAuth();
  const { showToast } = useToast();
  const [result, setResult] = useState<PageResult>(EMPTY); const [industries, setIndustries] = useState<AccountOption[]>([]); const [salesUsers, setSalesUsers] = useState<SalesOption[]>([]);
  const [searchDraft, setSearchDraft] = useState(""); const [search, setSearch] = useState(""); const [industryId, setIndustryId] = useState("ALL"); const [status, setStatus] = useState("ALL"); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [dialogError, setDialogError] = useState<string | null>(null);
  const [editor, setEditor] = useState<AccountValue | null | undefined>(undefined); const [selected, setSelected] = useState<AccountRow | null>(null); const [students, setStudents] = useState<AccountStudent[]>([]); const [pics, setPics] = useState<{ subject: string; name: string; email: string | null; status?: "PENDING" | "ACTIVE" | "INACTIVE" }[]>([]); const [detailsLoading, setDetailsLoading] = useState(false); const [deleting, setDeleting] = useState<AccountRow | null>(null);
  const currentSubject = String((keycloak.tokenParsed as { sub?: string } | undefined)?.sub ?? "");

  const load = useCallback(async () => { setLoading(true); setError(null); try {
    const query = new URLSearchParams({ page: String(page), pageSize: "8", status }); if (search) query.set("search", search); if (industryId !== "ALL") query.set("industryId", industryId);
    setResult(await api<PageResult>(`/api/v1/internal/accounts?${query}`));
  } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load Accounts"); } finally { setLoading(false); } }, [api, page, search, industryId, status]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setSearch(searchDraft.trim()); }, 250); return () => window.clearTimeout(timer); }, [searchDraft]);
  useEffect(() => { void Promise.all([api<{ items: AccountOption[] }>("/api/v1/internal/accounts/industries").then((r) => setIndustries(r.items)), api<{ items: SalesOption[] }>("/api/v1/internal/accounts/sales-users").then((r) => setSalesUsers(r.items))]).catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load Account options")); }, [api]);

  const openDetails = async (account: AccountRow) => { setSelected(account); setStudents([]); setPics([]); setDetailsLoading(true); try { const [studentResult, detail] = await Promise.all([api<{ items: AccountStudent[] }>(`/api/v1/internal/accounts/${account.id}/students`), api<{ item: AccountRow; pics: typeof pics }>(`/api/v1/internal/accounts/${account.id}`)]); setStudents(studentResult.items); setPics(detail.pics); } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load Account details"); } finally { setDetailsLoading(false); } };
  const save = async (value: { name: string; industryId: string; status: "ACTIVE" | "INACTIVE"; salesSubject?: string }) => { setBusy(true); setDialogError(null); try { const existing = editor && editor !== null ? editor.id : null; await api(`/api/v1/internal/accounts${existing ? `/${existing}` : ""}`, { method: existing ? "PUT" : "POST", body: JSON.stringify(value) }); showToast(existing ? "Account updated successfully." : "Account added successfully."); setEditor(undefined); setDialogError(null); setSelected(null); await load(); } catch (cause) { setDialogError(cause instanceof Error ? cause.message : "Failed to save Account"); } finally { setBusy(false); } };
  const remove = async () => { if (!deleting) return; setBusy(true); setError(null); try { await api(`/api/v1/internal/accounts/${deleting.id}`, { method: "DELETE" }); showToast("Account deleted successfully."); setDeleting(null); setSelected(null); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to delete Account"); setDeleting(null); } finally { setBusy(false); } };


  return (
    <AppShell title="Manage | Account">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-medium text-gray-600">Account</h1>
            <p className="mt-1 text-sm text-zinc-600">Manage your assigned client Accounts and Personal Accounts.</p>
          </div>
          <AddButton onClick={() => { setDialogError(null); setEditor(null); }}>Add Account</AddButton>
        </section>

        <section className="rounded-3xl border border-rose-50 bg-white p-5">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <Input
              id="account-search"
              label="Search Account"
              leftIcon="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search Account"
              containerClassName="w-full md:w-60"
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Dropdown
                label="Industry"
                value={industryId}
                onChange={(val) => {
                  setPage(1);
                  setIndustryId(val);
                }}
                options={[{ label: "All Industry", value: "ALL" }, ...industries.map((ind) => ({ label: ind.name, value: ind.id }))]}
                containerClassName="w-full sm:w-48"
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
                containerClassName="w-full sm:w-44"
              />
            </div>
          </div>

          {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <div className="overflow-x-auto rounded-xl border border-[#E9E9E9]">
            <table className="table-fixed w-full min-w-[760px] text-left text-sm">
              <thead className="bg-neutral-100 text-sm font-normal text-zinc-950/60 border-b border-[#E9E9E9]">
                <tr>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Code</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Account Name</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Industry</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Student</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">PIC</th>
                  <th className="px-3 py-3 font-normal text-zinc-950/40 uppercase">Status</th>
                  <th className="w-28 whitespace-nowrap px-3 py-3 font-normal text-zinc-950/60 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {!loading && result.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                      No Accounts found.
                    </td>
                  </tr>
                )}
                {result.items.map((row) => (
                  <tr key={row.id} className="border-t border-[#E9E9E9] text-zinc-700 transition-colors hover:bg-neutral-50/50">
                    <td className="px-3 py-3">{row.account_code}</td>
                    <td className="px-3 py-3">
                      <button className="text-left font-medium text-rose-600 hover:underline" onClick={() => void openDetails(row)}>
                        {row.name}
                      </button>
                    </td>
                    <td className="px-3 py-3">{row.industry_name ?? "—"}</td>
                    <td className="px-3 py-3">{row.student_count}</td>
                    <td className="px-3 py-3">
                      {row.pics.length ? (
                        <span title={row.pics.join(", ")}>
                          {row.pics[0]}
                          {row.pics.length > 1 ? ` + ${row.pics.length - 1}` : ""}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={row.status === "ACTIVE" ? "success" : "danger"} showDot>
                        {row.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="w-28 whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1">
                        <IconButton label={`View ${row.name}`} icon="eye" size="sm" onClick={() => void openDetails(row)} />
                        <IconButton label={`Edit ${row.name}`} icon="pencil-line" size="sm" onClick={() => setEditor(row)} />
                        <IconButton label={`Delete ${row.name}`} icon="trash" variant="danger" size="sm" onClick={() => setDeleting(row)} />
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                      Loading Accounts…
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
        </section>
      </div>
    {editor !== undefined && <AccountDialog value={editor ?? null} industries={industries} salesUsers={salesUsers} currentSubject={currentSubject} busy={busy} error={dialogError} onClose={() => { setEditor(undefined); setDialogError(null); }} onSubmit={save} />}
    {selected && <AccountDetailsDialog account={selected} pics={pics} students={students} loadingStudents={detailsLoading} canDelete={selected.training_count === 0} onClose={() => setSelected(null)} onEdit={() => { setDialogError(null); setEditor(selected); setSelected(null); }} onDelete={() => { if (!selected.training_count) setDeleting(selected); }} />}
    <DeleteConfirmationModal open={Boolean(deleting)} itemName={deleting?.name ?? ""} description={`Account “${deleting?.name ?? ""}” will be permanently deleted along with non-Training references. Account with Training history cannot be deleted.`} onClose={() => setDeleting(null)} onConfirm={() => void remove()} loading={busy} />
    </AppShell>
  );
}
