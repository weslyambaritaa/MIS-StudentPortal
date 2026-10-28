"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";

export type PicValue = { id?: string; name: string; email: string; account_id: string; account_name: string; account_status?: "ACTIVE" | "INACTIVE"; industry_name: string | null; status: "PENDING" | "ACTIVE" | "INACTIVE"; activation_expires_at?: string | null };
export type PicAccountOption = { id: string; account_code: string; name: string; industry_name: string | null; status?: "ACTIVE" | "INACTIVE" };

export function PicDialog({ value, accounts, busy, error, onClose, onSubmit }: {
  value: PicValue | null; accounts: PicAccountOption[]; busy: boolean; error: string | null;
  onClose: () => void; onSubmit: (data: { name: string; email: string; accountId?: string; status?: "ACTIVE" | "INACTIVE" }) => void;
}) {
  const [name, setName] = useState(value?.name ?? "");
  const [email, setEmail] = useState(value?.email ?? "");
  const [accountId, setAccountId] = useState(value?.account_id ?? "");
  const [accountSearch, setAccountSearch] = useState(value?.account_name ?? "");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(value?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE");
  const matchingAccounts = accounts.filter((account) => account.status === "ACTIVE" && account.name.toLocaleLowerCase().includes(accountSearch.trim().toLocaleLowerCase()));
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [busy, onClose]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!value && !accountId) { setAccountMenuOpen(Boolean(accountSearch.trim())); return; } onSubmit(value ? { name: name.trim(), email, ...(value.status === "PENDING" ? {} : { status }) } : { name: name.trim(), email: email.trim(), accountId }); };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form role="dialog" aria-modal="true" aria-labelledby="pic-dialog-title" onSubmit={submit} className="w-full max-w-md rounded-3xl border border-rose-50 bg-white p-5 shadow-xl">
      <header className="mb-6 flex items-start justify-between gap-4"><h2 id="pic-dialog-title" className="text-2xl font-medium text-gray-600">{value ? "Edit PIC" : "Add PIC"}</h2><IconButton label="Close" icon={<X size={18} />} onClick={onClose} disabled={busy} /></header>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="mb-4 block text-sm text-gray-600">PIC Name<input autoFocus required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter PIC name" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900" /></label>
      <label className="mb-4 block text-sm text-gray-600">PIC Email<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={Boolean(value)} placeholder="name@example.com" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900 disabled:cursor-not-allowed disabled:text-slate-500" />{value && <span className="mt-1 block text-xs text-zinc-500">Email is the Keycloak username and cannot be changed here.</span>}</label>
      <div className="relative mb-4">
        <label htmlFor="pic-account-search" className="block text-sm text-gray-600">Account *</label>
        <input
          id="pic-account-search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={!value && accountMenuOpen && accountSearch.trim().length > 0}
          aria-controls="pic-account-options"
          autoComplete="off"
          required={!value}
          value={accountSearch}
          disabled={Boolean(value)}
          placeholder="Pick an Account"
          onFocus={() => { if (accountSearch.trim()) setAccountMenuOpen(true); }}
          onChange={(event) => {
            setAccountSearch(event.target.value);
            setAccountId("");
            setAccountMenuOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setAccountMenuOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setAccountMenuOpen(false);
            if (event.key === "Enter" && accountMenuOpen && matchingAccounts.length === 1) {
              event.preventDefault();
              setAccountId(matchingAccounts[0].id);
              setAccountSearch(matchingAccounts[0].name);
              setAccountMenuOpen(false);
            }
          }}
          className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900 placeholder:text-slate-900/40 disabled:cursor-not-allowed disabled:text-slate-500"
        />
        {!value && accountMenuOpen && accountSearch.trim() && <ul id="pic-account-options" role="listbox" className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-rose-100 bg-white p-1 shadow-lg">
          {matchingAccounts.length ? matchingAccounts.map((account) => <li key={account.id} role="option" aria-selected={accountId === account.id}>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setAccountId(account.id); setAccountSearch(account.name); setAccountMenuOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-rose-50 focus:bg-rose-50 focus:outline-none">{account.name}</button>
          </li>) : <li className="px-3 py-2 text-sm text-zinc-500">No matching active accounts</li>}
        </ul>}
        {value && <span className="mt-1 block text-xs text-zinc-500">PIC Account assignment cannot be moved.</span>}
      </div>
      {value && <label className="mb-6 block text-sm text-gray-600">Status{value.status === "PENDING" ? <input readOnly value="Pending" className="mt-1 h-9 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-slate-500" /> : <select value={status} onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE")} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>}{value.status === "PENDING" && <span className="mt-1 block text-xs text-zinc-500">Pending changes to Active after the PIC completes account activation.</span>}</label>}
      <footer className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || !name.trim() || (!value && (!email.trim() || !accountId))}>{busy ? "Saving…" : value ? "Save Changes" : "Add PIC"}</Button></footer>
    </form>
  </div>;
}