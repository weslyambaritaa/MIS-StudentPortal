"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight, Pencil, Trash2, UserRound, X } from "lucide-react";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";
import type { AccountValue } from "./account-dialog";

export type AccountStudent = { subject: string; name: string; ongoingTrainings: string[] };

const avatarStyles = [
  "from-red-400 to-orange-600",
  "from-purple-400 to-fuchsia-600",
  "from-green-400 to-green-600",
  "from-indigo-400 to-indigo-700",
  "from-cyan-300 to-sky-500",
];

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";

export function AccountDetailsDialog({
  account,
  pics,
  students,
  loadingStudents,
  canDelete,
  onClose,
  onEdit,
  onDelete,
}: {
  account: AccountValue & { account_type: string; industry_code: string };
  pics: { subject: string; name: string; email: string | null; status?: "PENDING" | "ACTIVE" | "INACTIVE" }[];
  students: AccountStudent[];
  loadingStudents: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [selectedCourse, setSelectedCourse] = useState("ALL");
  const [viewAllStudents, setViewAllStudents] = useState(false);
  const courses = useMemo(
    () => [...new Set(students.flatMap((student) => student.ongoingTrainings))].sort((a, b) => a.localeCompare(b)),
    [students],
  );
  const visibleStudents = selectedCourse === "ALL"
    ? students
    : students.filter((student) => student.ongoingTrainings.includes(selectedCourse));
  const displayedStudents = viewAllStudents ? visibleStudents : visibleStudents.slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-zinc-950/30"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <aside aria-label="Account details" className="flex h-full w-full max-w-[420px] flex-col items-start justify-between overflow-hidden bg-white p-6 outline outline-1 outline-offset-[-1px] outline-gray-200 shadow-2xl">
        <div className="flex min-h-0 w-full flex-1 flex-col gap-6 self-stretch overflow-y-auto pr-1">
          <header className="flex shrink-0 items-start gap-3">
            <IconButton label="Close details" icon={<X size={18} />} onClick={onClose} />
            <h2 className="pt-0.5 text-2xl font-medium text-gray-600">Account Details</h2>
          </header>

          <section className="flex shrink-0 flex-col gap-3">
            <h3 className="text-base font-medium text-rose-600">Account Name</h3>
            <div className="flex items-center gap-3 overflow-hidden rounded-xl bg-[#FFFAFB] p-3 outline outline-1 outline-offset-[-1px] outline-[#FFE7EB]">
              <Building2 size={20} className="shrink-0 text-rose-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-gray-600">{account.name}</p>
                <p className="truncate text-sm text-zinc-600">{account.industry_name}</p>
              </div>
              <Badge variant={account.status === "ACTIVE" ? "success" : "danger"} showDot>
                {account.status === "ACTIVE" ? "Active" : "Inactive"}
              </Badge>
            </div>
          </section>

          <section className="flex shrink-0 flex-col gap-3">
            <h3 className="text-base font-medium text-rose-600">PIC Name</h3>
            {pics.length ? pics.map((pic) => (
              <div key={pic.subject} className="flex items-center gap-4 overflow-hidden rounded-xl bg-[#FFFAFB] p-3 outline outline-1 outline-offset-[-1px] outline-[#FFE7EB]">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserRound size={20} className="shrink-0 text-rose-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-gray-600">{pic.name}</p>
                    <p className="truncate text-sm font-medium text-zinc-600">{pic.email ?? ""}</p>
                  </div>
                </div>
                {pic.status && <Badge variant={pic.status === "ACTIVE" ? "success" : pic.status === "PENDING" ? "warning" : "danger"} showDot>{pic.status[0] + pic.status.slice(1).toLowerCase()}</Badge>}
                <ChevronRight size={20} className="shrink-0 text-zinc-600" />
              </div>
            )) : (
              <div className="flex w-full items-center gap-3 overflow-hidden rounded-xl bg-[#FFFAFB] p-3 outline outline-1 outline-offset-[-1px] outline-[#FFE7EB]">
                <UserRound size={20} className="shrink-0 text-rose-600" />
                <p className="flex-1 text-base font-medium text-gray-600">No PIC assigned.</p>
              </div>
            )}
          </section>

          <section className="flex min-h-0 flex-col gap-3">
            <h3 className="text-base font-medium text-rose-600">Available Student</h3>
            <label className="flex flex-col gap-[3px] text-sm text-gray-600">
              Course
              <span className="relative block">
                <select value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)} className="h-9 w-full appearance-none rounded-full border border-rose-600 bg-[#FFFAFB] px-3 pr-9 text-sm text-rose-600">
                  <option value="ALL">Showing All Course</option>
                  {courses.map((course) => <option key={course} value={course}>{course}</option>)}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              </span>
            </label>
            {loadingStudents ? <p className="py-3 text-center text-sm text-zinc-500">Loading students...</p> : visibleStudents.length ? (
              <div className="flex min-h-0 flex-col divide-y divide-rose-50">
                {displayedStudents.map((student, index) => (
                  <div key={student.subject} className="flex items-center gap-3 py-3">
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b ${avatarStyles[index % avatarStyles.length]} text-base font-medium text-white`}>{initials(student.name)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-600">{student.name}</p>
                      <p className="truncate text-sm text-zinc-600">{selectedCourse === "ALL" ? student.ongoingTrainings.join(", ") || "No ongoing class" : selectedCourse}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="py-2 text-center text-sm text-zinc-500">No students found for this course.</p>}
            <p className="text-center text-sm text-zinc-600">Available {visibleStudents.length} Student..</p>
            {visibleStudents.length > 5 && <button type="button" onClick={() => setViewAllStudents((current) => !current)} className="inline-flex w-full items-center justify-center gap-3 rounded-full px-3 py-2.5 text-base font-medium text-rose-600 hover:bg-rose-50">{viewAllStudents ? "Show Less" : "View All Student"}<ChevronRight size={18} className={viewAllStudents ? "rotate-90" : ""} /></button>}
          </section>
        </div>

        <footer className="mt-6 flex w-full shrink-0 gap-6 self-stretch pt-1">
          <Button variant="danger" leftIcon={<Trash2 size={18} />} onClick={onDelete} disabled={!canDelete} className="min-w-0 flex-1 whitespace-nowrap">Delete Account</Button>
          <Button leftIcon={<Pencil size={18} />} onClick={onEdit} className="min-w-0 flex-1 whitespace-nowrap">Edit Account</Button>
        </footer>
      </aside>
    </div>
  );
}

