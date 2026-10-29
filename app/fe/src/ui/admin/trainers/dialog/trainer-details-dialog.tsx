"use client";

import { BadgeCheck, BookOpen, Mail, Pencil, Star, Trash2, X } from "lucide-react";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";
import type { TrainerValue } from "./trainer-dialog";

type Training = { id: string; name: string; course_name?: string; status: string; assigned_at: string };
const initials = (name: string | null) => (name ?? "T").split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
const date = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value))
  : "—";
const daysUntil = (certificate: TrainerValue["certifications"][number]) => {
  if (typeof certificate.days_until_expiry === "number" && Number.isFinite(certificate.days_until_expiry)) return certificate.days_until_expiry;
  const rawDate = certificate.expires_at ?? certificate.expiresAt;
  const isoDate = rawDate ? rawDate.match(/\d{4}-\d{2}-\d{2}/)?.[0] : undefined;
  const expiry = isoDate ? new Date(`${isoDate}T00:00:00.000Z`) : null;
  if (!expiry || Number.isNaN(expiry.getTime())) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
};

export function TrainerDetailsDialog({ trainer, trainings, loading, onClose, onEdit, onDelete, onResendActivation }: {
  trainer: TrainerValue; trainings: Training[]; loading: boolean; onClose: () => void; onEdit: () => void; onDelete: () => void; onResendActivation: () => void;
}) {
  const status = trainer.status;
  return <div className="fixed inset-0 z-[90] flex justify-end bg-zinc-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="trainer-details-title" className="flex h-full w-full max-w-[26rem] flex-col border-l border-gray-200 bg-white p-6 shadow-xl">
      <div className="mb-6 flex items-start gap-3"><IconButton label="Close" icon={<X size={20} />} onClick={onClose} /><h2 id="trainer-details-title" className="text-2xl font-medium text-gray-600">Trainer Details</h2></div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
        <section>
          <h3 className="mb-3 text-base font-medium text-rose-600">Trainer Details</h3>
          <div className="rounded-xl border border-rose-50 bg-neutral-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-orange-600 text-base font-medium text-white">{initials(trainer.name)}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-base font-medium text-gray-600">{trainer.name || "Legacy trainer profile"}</p><p className="truncate text-sm font-medium text-zinc-600">{trainer.specialization}</p></div>
              <Badge variant={status === "ACTIVE" ? "success" : status === "PENDING" ? "warning" : "danger"} showDot>{status === "PENDING" ? "Pending" : status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="my-4 border-t border-zinc-950/20" />
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-0.5"><p className="flex items-center gap-1 text-base font-medium text-orange-400"><Star size={18} fill="currentColor" />{trainer.rating.toFixed(1)}</p><p className="text-sm font-medium text-zinc-600">Rating</p></div>
              <div className="flex flex-col gap-0.5"><p className="text-base font-medium text-rose-600">{trainer.yearly_class_count}</p><p className="text-sm font-medium text-zinc-600">Yearly Class</p></div>
              <div className="flex flex-col gap-0.5"><p className="text-base font-medium text-rose-600">{trainer.monthly_class_count}</p><p className="text-sm font-medium text-zinc-600">Monthly Class</p></div>
            </div>
          </div>
        </section>
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-base font-medium text-rose-600"><BadgeCheck size={19} />Trainer Certifications</h3>
          {trainer.certifications.length ? <div className="flex flex-wrap gap-2 rounded-xl border border-rose-50 bg-neutral-50 p-3">
            {trainer.certifications.map((certificate, index) => {
              const days = daysUntil(certificate);
              const expired = days !== null && days < 0;
              const soon = days !== null && days >= 0 && days <= 60;
              const style = expired ? "border-red-500 bg-red-500/10 text-red-600" : soon ? "border-orange-500 bg-orange-500/10 text-orange-600" : "border-blue-500 bg-blue-500/10 text-blue-600";
              const marker = expired ? "Kedaluwarsa" : soon ? `${days} hari lagi` : "";
              return <span key={certificate.id ?? `${certificate.name}-${index}`} title={`${certificate.name} · ${expired ? "Kedaluwarsa" : `Berakhir ${date(certificate.expires_at ?? certificate.expiresAt)}`}`} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${style}`}>{certificate.name}{marker && <span className="font-semibold">· {marker}</span>}</span>;
            })}
          </div> : <p className="rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-500">No certification records.</p>}
        </section>
        <section>
          <h3 className="mb-3 text-base font-medium text-rose-600">Active Training</h3>
          {loading ? <p className="rounded-xl bg-neutral-50 p-3 text-sm text-zinc-500">Loading trainings…</p> : trainings.length ? <ul className="space-y-1 rounded-xl border border-rose-50 bg-neutral-50">{trainings.map((training) => <li key={training.id} className="flex items-center gap-3 p-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-orange-600 text-white"><BookOpen size={19} /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-600">{training.name}</p><p className="truncate text-sm text-zinc-600">{training.course_name || training.status}</p></div>
          </li>)}</ul> : <p className="rounded-xl bg-neutral-50 p-3 text-sm text-zinc-500">No active training assignments.</p>}
        </section>
      </div>
      <p className="mt-4 text-xs text-zinc-500">Change Trainer status, including setting it to Inactive, through Edit. Permanent deletion is available only if the Trainer has never been assigned to a Training.</p>
      <footer className="mt-3 flex flex-wrap gap-2">{status === "PENDING" && trainer.activation_expires_at && new Date(trainer.activation_expires_at).getTime() <= Date.now() && <Button variant="navigation" leftIcon={<Mail size={17} />} onClick={onResendActivation}>Resend Activation</Button>}<Button variant="danger" leftIcon={<Trash2 size={17} />} onClick={onDelete} disabled={trainer.training_history_count > 0}>Delete</Button><Button leftIcon={<Pencil size={17} />} onClick={onEdit}>Edit Trainer</Button></footer>
    </aside>
  </div>;
}
