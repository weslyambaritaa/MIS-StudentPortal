"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";

export type AccountOption = { id: string; industry_code: string; name: string; status: "ACTIVE" | "INACTIVE" };
export type SalesOption = { subject: string; name: string; email: string | null };
export type AccountValue = { id: string; account_code: string; name: string; industry_id: string; industry_name: string; status: "ACTIVE" | "INACTIVE"; sales_subject: string };

export function AccountDialog({ value, industries, salesUsers, currentSubject, busy, error, onClose, onSubmit }: {
  value: AccountValue | null; industries: AccountOption[]; salesUsers: SalesOption[]; currentSubject: string;
  busy: boolean; error?: string | null; onClose: () => void; onSubmit: (payload: { name: string; industryId: string; status: "ACTIVE" | "INACTIVE"; salesSubject?: string }) => void;
}) {
  const [name, setName] = useState(value?.name ?? "");
  const [industryId, setIndustryId] = useState(value?.industry_id ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(value?.status ?? "ACTIVE");
  const [salesSubject, setSalesSubject] = useState(value?.sales_subject ?? currentSubject);
  const [industryError, setIndustryError] = useState<string | null>(null);
  const activeIndustries = industries.filter((industry) => industry.status === "ACTIVE");
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [busy, onClose]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!industryId) { setIndustryError("Choose an active Industry."); return; }
    setIndustryError(null);
    onSubmit({ name: name.trim(), industryId, status, ...(value ? { salesSubject } : {}) });
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" onSubmit={submit} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5 shadow-xl">
      <header className="mb-6 flex items-start justify-between"><h2 id="account-dialog-title" className="text-2xl font-medium text-gray-600">{value ? "Edit Account" : "Add Account"}</h2><IconButton label="Close" icon={<X size={18} />} onClick={onClose} disabled={busy} /></header>
      <label className="mb-4 block text-sm text-gray-600">Account Code<input value={value?.account_code ?? "Generated automatically"} readOnly className="mt-1 h-9 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-slate-500" /></label>
      <label className="mb-4 block text-sm text-gray-600">Account Name<input autoFocus required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Executrain Indonesia" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900" /></label>
      <div className="mb-4 text-sm text-gray-600"><label htmlFor="account-industry">Industry</label><span className="relative mt-1 block"><select id="account-industry" value={industryId} onChange={(event) => { setIndustryId(event.target.value); setIndustryError(null); }} aria-invalid={Boolean(industryError || error)} aria-describedby={industryError || error ? "account-industry-error" : undefined} className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-slate-900"><option value="">Choose an active Industry</option>{value && !activeIndustries.some((industry) => industry.id === value.industry_id) && <option hidden value={value.industry_id}>Current inactive Industry</option>}{activeIndustries.map((industry) => <option key={industry.id} value={industry.id}>{industry.name}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rose-600" /></span>{value && !activeIndustries.some((industry) => industry.id === value.industry_id) && <span className="mt-1 block text-xs text-zinc-500">Current Industry is inactive. It remains unchanged unless you select an active Industry.</span>}{(industryError || error) && <p id="account-industry-error" role="alert" className="mt-1 text-sm text-red-600">{industryError ?? error}</p>}</div>
      {value && <label className="mb-4 block text-sm text-gray-600">Sales Owner<select required value={salesSubject} onChange={(event) => setSalesSubject(event.target.value)} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900">{salesUsers.map((sales) => <option key={sales.subject} value={sales.subject}>{sales.name}{sales.email ? ` - ${sales.email}` : ""}</option>)}</select><span className="mt-1 block text-xs text-zinc-500">Changing the owner transfers this Account and keeps assignment history.</span></label>}
      <label className="mb-6 block text-sm text-gray-600">Status<select value={status} onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE")} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 text-slate-900"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
      <footer className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || !name.trim() || !industryId}>{busy ? "Saving..." : value ? "Save Changes" : "Add Account"}</Button></footer>
    </form>
  </div>;
}
