"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@mis/ui/button";
import { Dropdown } from "@mis/ui/dropdown";
import { IconButton } from "@mis/ui/icon-button";
import { Input } from "@mis/ui/input";

export type PicValue = { id?: string; name: string; email: string; account_id: string; account_name: string; account_status?: "ACTIVE" | "INACTIVE"; industry_name: string | null; status: "PENDING" | "ACTIVE" | "INACTIVE"; activation_expires_at?: string | null };
export type PicAccountOption = { id: string; account_code: string; name: string; industry_name: string | null; status?: "ACTIVE" | "INACTIVE" };

export function PicDialog({ value, accounts, busy, error, onClose, onSubmit }: {
  value: PicValue | null; accounts: PicAccountOption[]; busy: boolean; error: string | null;
  onClose: () => void; onSubmit: (data: { name: string; email: string; accountId?: string; status?: "ACTIVE" | "INACTIVE" }) => void;
}) {
  const [name, setName] = useState(value?.name ?? "");
  const [email, setEmail] = useState(value?.email ?? "");
  const [accountId, setAccountId] = useState(value?.account_id ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(value?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE");

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!value && !accountId) return;
    onSubmit(value ? { name: name.trim(), email, ...(value.status === "PENDING" ? {} : { status }) } : { name: name.trim(), email: email.trim(), accountId });
  };

  const activeAccounts = accounts.filter((account) => account.status === "ACTIVE");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="pic-dialog-title" onSubmit={submit} className="w-full max-w-md rounded-3xl border border-rose-50 bg-white p-5 shadow-xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <h2 id="pic-dialog-title" className="text-2xl font-medium text-gray-600">{value ? "Edit PIC" : "Add PIC"}</h2>
          <IconButton label="Close" icon="x" onClick={onClose} disabled={busy} />
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Input
          label="PIC Name"
          autoFocus
          required
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter PIC name"
          containerClassName="mb-4"
        />
        <div className="mb-4">
          <Input
            label="PIC Email"
            required
            type="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={Boolean(value)}
            placeholder="name@example.com"
          />
          {value && <span className="mt-1 block text-xs text-zinc-500">Email is the Keycloak username and cannot be changed here.</span>}
        </div>
        <div className="mb-4">
          {value ? (
            <>
              <Input
                label="Account"
                required
                value={value.account_name}
                readOnly
                disabled
              />
              <span className="mt-1 block text-xs text-zinc-500">PIC Account assignment cannot be moved.</span>
            </>
          ) : (
            <Dropdown
              label="Account"
              required
              searchable
              value={accountId}
              placeholder="Pick an Account"
              onChange={(val) => setAccountId(val)}
              options={activeAccounts.map((a) => ({ label: a.name, value: a.id }))}
            />
          )}
        </div>
        {value && (
          <div className="mb-6">
            {value.status === "PENDING" ? (
              <Input
                label="Status"
                value="Pending"
                readOnly
                disabled
              />
            ) : (
              <Dropdown
                label="Status"
                required
                value={status}
                onChange={(val) => setStatus(val as "ACTIVE" | "INACTIVE")}
                options={[
                  { label: "Active", value: "ACTIVE" },
                  { label: "Inactive", value: "INACTIVE" },
                ]}
              />
            )}
            {value.status === "PENDING" && <span className="mt-1 block text-xs text-zinc-500">Pending changes to Active after the PIC completes account activation.</span>}
          </div>
        )}
        <footer className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy || !name.trim() || (!value && (!email.trim() || !accountId))} leftIcon={value ? "pencil-line" : "plus"}>{busy ? "Saving…" : value ? "Save Changes" : "Add PIC"}</Button>
        </footer>
      </form>
    </div>
  );
}
