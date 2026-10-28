"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@mis/ui/button";
import { DataTable, type DataTableColumn } from "@mis/ui/data-table";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@mis/ui/toast";

type PersonalAccount = { id: string; account_code: string; name: string; status: string; personal_student_subject: string | null; student_name: string | null };
type Student = { subject: string; name: string; username: string; email: string | null };

export default function PersonalAccountLinksPage() {
  const api = useApi(); const [accounts, setAccounts] = useState<PersonalAccount[]>([]); const [students, setStudents] = useState<Student[]>([]); const [selected, setSelected] = useState<Record<string, string>>({}); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const load = useCallback(async () => { setLoading(true); setError(null); try { const result = await api<{ accounts: PersonalAccount[]; students: Student[] }>("/api/v1/internal/accounts/admin/personal-links"); setAccounts(result.accounts); setStudents(result.students); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load Personal Accounts"); } finally { setLoading(false); } }, [api]);
  useEffect(() => { void load(); }, [load]);
  const link = async (account: PersonalAccount) => { const studentSubject = selected[account.id]; if (!studentSubject) return; setSaving(account.id); setError(null); try { await api(`/api/v1/internal/accounts/admin/personal-links/${account.id}`, { method: "PUT", body: JSON.stringify({ studentSubject }) }); showToast(`Student linked to Account ${account.account_code} successfully.`); setSelected((value) => { const next = { ...value }; delete next[account.id]; return next; }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not link Student"); } finally { setSaving(null); } };
  const columns: DataTableColumn<PersonalAccount>[] = [
    { key: "code", header: "Account Code", render: (account) => account.account_code },
    { key: "account", header: "Personal Account", render: (account) => account.name },
    { key: "student", header: "Linked Student", render: (account) => account.student_name ?? <span className="text-zinc-400">Not linked</span> },
    { key: "link", header: "Assign Student", render: (account) => account.personal_student_subject ? <span className="text-sm text-zinc-500">Student already linked</span> : <div className="flex min-w-72 gap-2"><select aria-label={`Student for ${account.name}`} value={selected[account.id] ?? ""} onChange={(event) => setSelected((value) => ({ ...value, [account.id]: event.target.value }))} className="h-9 min-w-0 flex-1 rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm"><option value="">Choose Student</option>{students.map((student) => <option key={student.subject} value={student.subject}>{student.name} Ã‚Â· {student.username}</option>)}</select><Button size="sm" disabled={!selected[account.id] || saving === account.id} onClick={() => void link(account)}>{saving === account.id ? "SavingÃ¢â‚¬Â¦" : "Assign"}</Button></div> },
  ];
  return <AppShell title="Master Data | Personal Account Students"><div className="flex flex-col gap-6"><section className="rounded-3xl border border-rose-50 bg-white p-5"><h1 className="text-3xl font-medium text-gray-600">Personal Account Students</h1><p className="mt-1 text-sm text-zinc-600">Link each Personal Account to one enabled Keycloak user with the Student role. This does not create a Student profile.</p></section><section className="rounded-3xl border border-rose-50 bg-white p-5">{error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{loading ? <p className="py-10 text-center text-zinc-500">Loading Personal AccountsÃ¢â‚¬Â¦</p> : <DataTable columns={columns} rows={accounts} getRowKey={(account) => account.id} emptyMessage="No Personal Accounts found." caption="Personal Account Student links" />}</section></div></AppShell>;
}
