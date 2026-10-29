"use client";

import { useState } from "react";
import { ArrowRight, Building2, ChevronDown, Pencil, Trash2, UserRound, X } from "lucide-react";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";
import type { PicValue } from "./pic-dialog";

export type PicStudent = { subject: string; name: string; ongoingTrainings: string[] };

export function PicDetailsDialog({
  item,
  students,
  loading,
  onClose,
  onEdit,
  onDelete,
}: {
  item: PicValue;
  students: PicStudent[];
  loading: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [course, setCourse] = useState("ALL");
  const [showAll, setShowAll] = useState(false);
  const statusVariant = item.status === "ACTIVE" ? "success" : item.status === "PENDING" ? "warning" : "danger";
  const courses = [...new Set(students.flatMap((student) => student.ongoingTrainings))];
  const filteredStudents = students.filter((student) => course === "ALL" || student.ongoingTrainings.includes(course));
  const visibleStudents = showAll ? filteredStudents : filteredStudents.slice(0, 5);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-zinc-950/30" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label="PIC Details" className="flex h-full w-full max-w-[440px] flex-col border-l border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <IconButton label="Close PIC details" icon={<X size={18} />} onClick={onClose} />
          <h2 className="text-2xl font-medium text-gray-600">PIC Details</h2>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          <section className="space-y-3">
            <h3 className="font-medium text-rose-600">PIC Name</h3>
            <div className="flex items-center gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">
              <UserRound size={20} className="shrink-0 text-rose-600" />
              <div className="min-w-0 flex-1"><p className="truncate font-medium text-gray-600">{item.name}</p><p className="truncate text-sm text-zinc-600">{item.email}</p></div>
              <Badge variant={statusVariant} showDot>{item.status[0] + item.status.slice(1).toLowerCase()}</Badge>
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="font-medium text-rose-600">PIC’s Account</h3>
            <div className="flex items-center gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">
              <Building2 size={20} className="shrink-0 text-rose-600" />
              <div className="min-w-0 flex-1"><p className="truncate font-medium text-gray-600">{item.account_name}</p><p className="truncate text-sm text-zinc-600">{item.industry_name ?? "—"}</p></div>
              <Badge variant={item.account_status === "ACTIVE" ? "success" : "danger"} showDot>{item.account_status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="font-medium text-rose-600">Account Available Student</h3>
            <label className="block text-sm text-gray-600">Course<span className="relative mt-1 block">
              <select aria-label="Course filter" value={course} onChange={(event) => { setCourse(event.target.value); setShowAll(false); }} className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-neutral-50 px-3 pr-9 text-sm text-rose-600">
                <option value="ALL">Showing All Course</option>{courses.map((name) => <option key={name} value={name}>{name}</option>)}
              </select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </span></label>
            {loading ? <p className="py-4 text-center text-sm text-zinc-500">Loading students…</p> : filteredStudents.length ? (
              <ul className="divide-y divide-rose-50">{visibleStudents.map((student, index) => (
                <li key={student.subject} className="flex items-center gap-3 py-3">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${["from-red-400 to-orange-600", "from-purple-400 to-fuchsia-600", "from-green-400 to-green-600", "from-indigo-400 to-indigo-700", "from-cyan-300 to-sky-500"][index % 5]} text-sm font-medium text-white`}>{student.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-600">{student.name}</p><p className="truncate text-sm text-zinc-600">{student.ongoingTrainings.join(", ") || "No ongoing course"}</p></div>
                </li>
              ))}</ul>
            ) : <p className="rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-500">No students found for this Account.</p>}
            <p className="text-center text-sm text-zinc-500">{filteredStudents.length} Student{filteredStudents.length === 1 ? "" : "s"}</p>
            {filteredStudents.length > 5 && <Button variant="ghost" className="w-full" rightIcon={<ArrowRight size={18} />} onClick={() => setShowAll((value) => !value)}>{showAll ? "Show Less" : "View All Student"}</Button>}
          </section>
        </div>
        <footer className="mt-5 flex gap-3 border-t border-rose-50 pt-4">
          <Button variant="danger" className="min-w-0 flex-1 whitespace-nowrap" leftIcon={<Trash2 size={17} />} onClick={onDelete}>Delete PIC</Button>
          <Button className="min-w-0 flex-1 whitespace-nowrap" leftIcon={<Pencil size={17} />} onClick={onEdit}>Edit PIC</Button>
        </footer>
      </aside>
    </div>
  );
}

