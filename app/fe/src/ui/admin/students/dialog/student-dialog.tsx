"use client";
import { DropdownSelect } from "@mis/ui/dropdown-select";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, Info, Search, X } from "lucide-react";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";

export type StudentPortalStatus = "ACTIVE" | "INACTIVE" | "HAVENT_LOGIN";
export type StudentValue = {
  id: string;
  name: string;
  email: string;
  company_role: string | null;
  account_id: string;
  account_name: string;
  account_status?: "ACTIVE" | "INACTIVE";
  portal_status: StudentPortalStatus;
  first_login_at: string | null;
  last_login_at: string | null;
  activation_expires_at: string | null;
  class_history_count: number;
};
export type StudentAccountOption = { id: string; account_code: string; name: string };

export function StudentDialog({ value, accounts, busy, error, onClose, onSubmit }: {
  value: StudentValue | null;
  accounts: StudentAccountOption[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: { name: string; email: string; accountId: string; companyRole: string; portalStatus?: "ACTIVE" | "INACTIVE" }) => void;
}) {
  const [name, setName] = useState(value?.name ?? "");
  const [email, setEmail] = useState(value?.email ?? "");
  const [accountId, setAccountId] = useState(value?.account_id ?? "");
  const [accountQuery, setAccountQuery] = useState(value?.account_name ?? "");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [companyRole, setCompanyRole] = useState(value?.company_role ?? "");
  const [portalStatus, setPortalStatus] = useState<"ACTIVE" | "INACTIVE">(value?.portal_status === "INACTIVE" ? "INACTIVE" : "ACTIVE");

  const matchingAccounts = useMemo(() => {
    const query = accountQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    return accounts.filter((account) => `${account.name} ${account.account_code}`.toLocaleLowerCase().includes(query));
  }, [accountQuery, accounts]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ name: name.trim(), email: email.trim(), accountId, companyRole: companyRole.trim(), ...(value ? { portalStatus } : {}) });
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form role="dialog" aria-modal="true" aria-labelledby="student-dialog-title" onSubmit={submit} className="max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5 shadow-xl">
      <header className="mb-6 flex items-start justify-between gap-4"><h2 id="student-dialog-title" className="text-2xl font-medium text-gray-600">{value ? "Edit Student" : "Add Student"}</h2><IconButton label="Close" icon={<X size={18} />} onClick={onClose} disabled={busy} /></header>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="mb-4 block text-sm text-gray-600">Student Name *<input autoFocus required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Dewi Santoso" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900" /></label>
      <label className="mb-4 block text-sm text-gray-600">Email *<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={Boolean(value)} placeholder="student@company.com" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900 disabled:cursor-not-allowed disabled:text-slate-500" />{value && <span className="mt-1 block text-xs text-zinc-500">Email is the Keycloak username and cannot be changed here.</span>}</label>
      <div className="relative mb-4">
        <label htmlFor="student-account-search" className="block text-sm text-gray-600">Account *</label>
        <span className="mt-1 flex h-9 w-full items-center gap-2 rounded-full border border-rose-600 bg-neutral-50 px-3 focus-within:ring-2 focus-within:ring-rose-200">
          <Search size={16} className="shrink-0 text-slate-900/40" aria-hidden="true" />
          <input
            id="student-account-search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={accountMenuOpen && accountQuery.trim().length > 0}
            aria-controls="student-account-options"
            autoComplete="off"
            required={!accountId}
            value={accountQuery}
            onChange={(event) => {
              setAccountQuery(event.target.value);
              setAccountId("");
              setAccountMenuOpen(Boolean(event.target.value.trim()));
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && accountMenuOpen) {
                event.stopPropagation();
                setAccountMenuOpen(false);
              }
            }}
            placeholder="Search Account"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-900/40"
          />
          <ChevronDown size={16} className="shrink-0 text-slate-900/40" aria-hidden="true" />
        </span>
        {accountMenuOpen && accountQuery.trim() && <ul id="student-account-options" role="listbox" className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-rose-100 bg-white py-1 shadow-lg">
          {matchingAccounts.length ? matchingAccounts.map((account) => <li key={account.id} role="option" aria-selected={account.id === accountId}>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setAccountId(account.id); setAccountQuery(account.name); setAccountMenuOpen(false); }} className="flex w-full flex-col px-3 py-2 text-left hover:bg-rose-50 focus:bg-rose-50 focus:outline-none">
              <span className="text-sm font-medium text-gray-700">{account.name}</span>
              <span className="text-xs text-zinc-500">{account.account_code}</span>
            </button>
          </li>) : <li className="px-3 py-2 text-sm text-zinc-500">No matching Account found.</li>}
        </ul>}
      </div>
      <label className="mb-5 block text-sm text-gray-600">Student Company Role<input maxLength={200} value={companyRole} onChange={(event) => setCompanyRole(event.target.value)} placeholder="Example: HR Specialist" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900" /></label>
      {value && <label className="mb-5 block text-sm text-gray-600">Portal Status<DropdownSelect value={portalStatus} onChange={(event) => setPortalStatus(event.target.value as "ACTIVE" | "INACTIVE")} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></DropdownSelect>{value.portal_status === "HAVENT_LOGIN" && <span className="mt-1 block text-xs text-zinc-500">Haven’t Login is determined by the system until the first successful login.</span>}</label>}
      {!value && <div className="mb-6 rounded-3xl border border-blue-500 bg-blue-500/10 p-3 text-sm">
        <div className="flex items-center gap-1 font-medium text-blue-600"><Info size={18} />With Portal Account</div>
        <p className="mt-2 text-slate-600">An activation email will be sent to the Student. The link lets them set a password and access the portal.</p>
      </div>}
      <footer className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || !name.trim() || !accountId || (!value && !email.trim())}>{busy ? "Saving…" : value ? "Save Student" : "Add Student"}</Button></footer>
    </form>
  </div>;
}
