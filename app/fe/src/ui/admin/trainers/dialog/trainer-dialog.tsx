"use client";

import { useState, type FormEvent } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";

export type TrainerCertification = { id?: string; name: string; expires_at?: string; expiresAt?: string; days_until_expiry?: number };
export type TrainerValue = {
  id: string; trainer_code: string | null; name: string | null; email: string | null; specialization: string;
  rating: number; status: "PENDING" | "ACTIVE" | "INACTIVE"; first_login_at: string | null; activation_expires_at: string | null;
  yearly_class_count: number; monthly_class_count: number; training_history_count: number; certifications: TrainerCertification[];
};
export type TrainerSubmitValue = { trainerCode?: string; name: string; email?: string; specialization: string; status?: "PENDING" | "ACTIVE" | "INACTIVE"; certifications: { name: string; expiresAt: string }[] };

export function TrainerDialog({ value, busy, error, onClose, onSubmit }: {
  value: TrainerValue | null; busy: boolean; error: string | null; onClose: () => void;
  onSubmit: (payload: TrainerSubmitValue) => void;
}) {
  const [trainerCode, setTrainerCode] = useState(value?.trainer_code ?? "");
  const [name, setName] = useState(value?.name ?? "");
  const [email, setEmail] = useState(value?.email ?? "");
  const [specialization, setSpecialization] = useState(value?.specialization ?? "");
  const [status, setStatus] = useState<"PENDING" | "ACTIVE" | "INACTIVE">(value?.status ?? "ACTIVE");
  const [certifications, setCertifications] = useState<{ name: string; expiresAt: string }[]>(value?.certifications.map((certificate) => ({ name: certificate.name, expiresAt: String(certificate.expires_at ?? certificate.expiresAt ?? "").slice(0, 10) })) ?? [{ name: "", expiresAt: "" }]);
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit({ ...(value ? {} : { trainerCode: trainerCode.trim(), email: email.trim() }), name: name.trim(), specialization: specialization.trim(), ...(value ? { status } : {}), certifications: certifications.filter((item) => item.name.trim() || item.expiresAt).map((item) => ({ name: item.name.trim(), expiresAt: item.expiresAt })) }); };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form role="dialog" aria-modal="true" aria-labelledby="trainer-dialog-title" onSubmit={submit} className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5 shadow-xl">
      <header className="mb-6 flex items-start justify-between"><h2 id="trainer-dialog-title" className="text-2xl font-medium text-gray-600">{value ? "Edit Trainer" : "Add Trainer"}</h2><IconButton label="Close" icon={<X size={18} />} onClick={onClose} disabled={busy} /></header>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!value && <label className="mb-4 block text-sm text-gray-600">Trainer Code *<input autoFocus required maxLength={50} value={trainerCode} onChange={(event) => setTrainerCode(event.target.value)} placeholder="Example: TRN-001" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3" /></label>}
      <label className="mb-4 block text-sm text-gray-600">Trainer Name *<input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Dewi Santoso" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3" /></label>
      {!value && <label className="mb-4 block text-sm text-gray-600">Email *<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="trainer@company.com" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3" /></label>}
      <label className="mb-4 block text-sm text-gray-600">Speciality *<input required autoComplete="off" maxLength={255} value={specialization} onChange={(event) => setSpecialization(event.target.value)} placeholder="Enter a speciality" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3" /></label>
      {value && <label className="mb-5 block text-sm text-gray-600">Trainer Status<select value={status} disabled={value.status === "PENDING"} onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE")} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3 disabled:opacity-70"><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>{value.status === "PENDING" && <span className="mt-1 block text-xs text-zinc-500">Pending status is managed by the activation flow.</span>}</label>}
      <section className="mb-6"><div className="mb-3 flex items-center justify-between"><h3 className="font-medium text-rose-600">Certification</h3><Button type="button" variant="ghost" leftIcon="plus" onClick={() => setCertifications((items) => [...items, { name: "", expiresAt: "" }])}>Add Certificate</Button></div>
        {certifications.map((item, index) => <div key={index} className="mb-3 grid grid-cols-1 gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3 sm:grid-cols-[1fr_150px]"><label className="text-sm text-gray-600">Certification Name<input value={item.name} maxLength={200} onChange={(event) => setCertifications((items) => items.map((current, i) => i === index ? { ...current, name: event.target.value } : current))} placeholder="Example: PMP" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-white px-3" /></label><label className="text-sm text-gray-600">Expiry Date<input type="date" required={Boolean(item.name)} value={item.expiresAt} onChange={(event) => setCertifications((items) => items.map((current, i) => i === index ? { ...current, expiresAt: event.target.value } : current))} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-white px-3" /></label><button type="button" onClick={() => setCertifications((items) => items.filter((_, i) => i !== index))} className="text-left text-xs text-rose-600 underline">Remove certificate</button></div>)}
      </section>
      {!value && <div className="mb-6 rounded-3xl border border-blue-500 bg-blue-500/10 p-3 text-sm"><div className="flex items-center gap-1 font-medium text-blue-600"><Info size={18} />With Portal Account</div><p className="mt-2 text-slate-600">An activation email will be sent to the Trainer. The link is valid for 24 hours and lets them set a password.</p></div>}
      <footer className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || !name.trim() || !specialization.trim() || (!value && (!email.trim() || !trainerCode.trim()))}>{busy ? "Saving…" : value ? "Save Trainer" : "Add Trainer"}</Button></footer>
    </form>
  </div>;
}
