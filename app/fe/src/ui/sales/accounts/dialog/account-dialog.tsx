"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@mis/ui/button";
import { Dropdown } from "@mis/ui/dropdown";
import { IconButton } from "@mis/ui/icon-button";
import { Input } from "@mis/ui/input";

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
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-600">Account Code</label>
        <input value={value?.account_code ?? "Generated automatically"} readOnly className="mt-1 h-9 w-full rounded-full border border-rose-100 bg-neutral-50 px-3 text-sm text-slate-500 outline-none" />
      </div>
      <Input
        label="Account Name"
        autoFocus
        required
        maxLength={200}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Example: Executrain Indonesia"
        containerClassName="mb-4"
      />
      <div className="mb-4">
        <Dropdown
          label="Industry"
          value={industryId}
          placeholder="Choose an active Industry"
          onChange={(val) => {
            setIndustryId(val);
            setIndustryError(null);
          }}
          options={activeIndustries.map((ind) => ({ label: ind.name, value: ind.id }))}
        />
        {value && !activeIndustries.some((industry) => industry.id === value.industry_id) && <span className="mt-1 block text-xs text-zinc-500">Current Industry is inactive. It remains unchanged unless you select an active Industry.</span>}
        {(industryError || error) && <p id="account-industry-error" role="alert" className="mt-1 text-sm text-red-600">{industryError ?? error}</p>}
      </div>
      {value && <div className="mb-4">
        <Dropdown
          label="Sales Owner"
          value={salesSubject}
          onChange={(val) => setSalesSubject(val)}
          options={salesUsers.map((sales) => ({ label: `${sales.name}${sales.email ? ` - ${sales.email}` : ""}`, value: sales.subject }))}
        />
        <span className="mt-1 block text-xs text-zinc-500">Changing the owner transfers this Account and keeps assignment history.</span>
      </div>}
      <Dropdown
        label="Status"
        value={status}
        onChange={(val) => setStatus(val as "ACTIVE" | "INACTIVE")}
        options={[
          { label: "Active", value: "ACTIVE" },
          { label: "Inactive", value: "INACTIVE" },
        ]}
        containerClassName="mb-6"
      />
      <footer className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || !name.trim() || !industryId}>{busy ? "Saving..." : value ? "Save Changes" : "Add Account"}</Button></footer>
    </form>
  </div>;
}

