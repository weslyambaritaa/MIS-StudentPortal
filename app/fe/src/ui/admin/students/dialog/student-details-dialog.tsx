"use client";

import { Building2, GraduationCap, Info, Mail, Pencil, Trash2, UserRound, X } from "lucide-react";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";
import type { StudentValue } from "./student-dialog";

type Training = { id: string; name: string; status: string; training_type: string };
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "ST";
const portalLabel = (status: StudentValue["portal_status"]) => status === "HAVENT_LOGIN" ? "HavenÃ¢â‚¬â„¢t Login" : status === "ACTIVE" ? "Active" : "Inactive";
const portalVariant = (status: StudentValue["portal_status"]) => status === "ACTIVE" ? "success" : status === "HAVENT_LOGIN" ? "warning" : "danger";

export function StudentDetailsDialog({ student, trainings, loading, busy, onClose, onEdit, onDelete, onResendActivation }: {
  student: StudentValue;
  trainings: Training[];
  loading: boolean;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onResendActivation: () => void;
}) {
  const hasHistory = student.class_history_count > 0;
  return <div className="fixed inset-0 z-[90] flex justify-end bg-zinc-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="student-details-title" className="flex h-full w-full max-w-[420px] flex-col border-l border-gray-200 bg-white p-6 shadow-2xl">
      <header className="mb-6 flex items-center gap-3"><IconButton label="Close Student details" icon={<X size={20}/>} onClick={onClose}/><h2 id="student-details-title" className="text-2xl font-medium text-gray-600">Student Details</h2></header>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="space-y-3"><h3 className="text-base font-medium text-rose-600">Student Name</h3><div className="space-y-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">
          <div className="flex items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-radial-[at_50%_0%] from-red-400 to-orange-600 text-base font-medium text-white">{initials(student.name)}</div><div className="min-w-0 flex-1"><p className="truncate font-medium text-gray-600">{student.name}</p><p className="truncate text-sm text-zinc-600">{student.email}</p></div></div>
          <div className="rounded-3xl border border-rose-600 bg-rose-50 px-3 py-2.5"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1 text-sm font-medium text-rose-600"><UserRound size={18}/>Student Portal Account</span><Badge variant={portalVariant(student.portal_status)} showDot>{portalLabel(student.portal_status)}</Badge></div><p className="mt-2 text-sm text-zinc-600">{student.portal_status === "INACTIVE" ? "Student portal access is inactive." : student.last_login_at || student.first_login_at ? `The student portal account is active. Last login was ${new Date(student.last_login_at ?? student.first_login_at!).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.` : `The student has not logged in yet.${student.activation_expires_at ? ` Activation link expires ${new Date(student.activation_expires_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.` : ""}`}</p>{student.portal_status === "HAVENT_LOGIN" && <Button variant="ghost" size="sm" leftIcon={<Mail size={16}/>} disabled={busy || Boolean(student.activation_expires_at && new Date(student.activation_expires_at).getTime() > Date.now())} onClick={onResendActivation} className="mt-2">{student.activation_expires_at && new Date(student.activation_expires_at).getTime() > Date.now() ? "Resend available after link expires" : "Resend Activation Link"}</Button>}</div>
        </div></section>
        <section className="space-y-3"><h3 className="text-base font-medium text-rose-600">StudentÃ¢â‚¬â„¢s Account &amp; Role</h3><div className="flex items-center gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3"><Building2 size={20} className="shrink-0 text-rose-600"/><div className="min-w-0"><p className="truncate font-medium text-gray-600">{student.account_name}</p><p className="truncate text-sm text-zinc-600">{student.company_role || "No company role specified"}</p></div></div></section>
        <section className="space-y-3"><h3 className="text-base font-medium text-rose-600">Active Training</h3>{loading ? <p className="text-sm text-zinc-500">Loading training historyÃ¢â‚¬Â¦</p> : trainings.filter((training) => training.status === "ONGOING").length ? <div className="divide-y divide-rose-50 rounded-xl border border-rose-50 bg-neutral-50 px-3">{trainings.filter((training) => training.status === "ONGOING").map((training, index) => <div key={training.id} className="flex items-center gap-3 py-3"><div className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${["from-red-400 to-orange-600", "from-purple-400 to-fuchsia-600", "from-green-400 to-green-600", "from-indigo-400 to-indigo-700", "from-cyan-300 to-sky-500"][index % 5]} text-white`}><GraduationCap size={20}/></div><div className="min-w-0"><p className="font-medium text-gray-600">{training.training_type}</p><p className="truncate text-sm text-zinc-600">{training.name}</p></div></div>)}</div> : <p className="rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-500">No active training.</p>}</section>
        <section className="rounded-3xl border border-blue-500 bg-blue-500/10 p-3"><div className="flex items-center gap-1 text-sm font-medium text-blue-600"><Info size={18}/>With Portal Account</div><p className="mt-2 text-sm text-slate-600">The student portal account is managed with the Student profile. Access is revoked when the portal status is Inactive.</p></section>
      </div>
      <footer className="mt-6 flex gap-3"><Button variant="danger" className="min-w-0 flex-1" leftIcon={<Trash2 size={18}/>} onClick={onDelete}>Delete Student</Button><Button className="min-w-0 flex-1" leftIcon={<Pencil size={18}/>} onClick={onEdit}>Edit Student</Button></footer>
      {hasHistory && <p className="mt-2 text-center text-xs text-amber-700">Cannot delete: this Student has {student.class_history_count} class history record{student.class_history_count === 1 ? "" : "s"}.</p>}
    </aside>
  </div>;
}
