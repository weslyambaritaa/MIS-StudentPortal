"use client";

import { BookOpen, ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import type { CourseValue } from "./course-dialog";

export function CourseDetailsDialog({ course, loading, onClose }: { course: CourseValue; loading: boolean; onClose: () => void }) {
  return <div className="fixed inset-0 z-[90] flex justify-end bg-zinc-950/40" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="course-details-title" className="flex h-full w-full max-w-[26rem] flex-col border-l border-gray-200 bg-white p-6 shadow-xl">
      <header className="mb-6 flex items-start gap-3"><IconButton label="Close" icon={<X size={20}/>} onClick={onClose}/><h2 id="course-details-title" className="text-2xl font-medium text-gray-600">Course Details</h2></header>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
        <section><h3 className="mb-3 text-base font-medium text-rose-600">Course Details</h3><div className="rounded-xl border border-rose-50 bg-neutral-50 p-3"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-orange-600 text-white"><BookOpen size={19}/></span><div className="min-w-0 flex-1"><p className="truncate text-base font-medium text-gray-600">{course.course_code}</p><p className="truncate text-sm text-zinc-600">{course.name}</p></div><Badge variant={course.status === "ACTIVE" ? "success" : "danger"} showDot>{course.status === "ACTIVE" ? "Active" : "Inactive"}</Badge></div><div className="my-4 border-t border-zinc-950/20"/><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-zinc-500">Category</dt><dd className="font-medium text-gray-700">{course.category_name}</dd></div><div><dt className="text-zinc-500">Duration</dt><dd className="font-medium text-gray-700">{course.duration_days ?? Math.ceil(course.duration_minutes / 480)} Days</dd></div><div><dt className="text-zinc-500">Level</dt><dd className="font-medium text-gray-700">{course.level}</dd></div></dl></div></section>
        <section><h3 className="mb-3 text-base font-medium text-rose-600">Syllabus Versions</h3>{loading ? <p className="rounded-xl bg-neutral-50 p-3 text-sm text-zinc-500">Loading versions…</p> : course.syllabuses?.length ? <ul className="space-y-2">{course.syllabuses.map(syllabus => <li key={syllabus.id} className="flex items-center gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600"><BookOpen size={17}/></span><div className="min-w-0 flex-1"><p className="font-medium text-gray-700">{syllabus.version}</p><p className="truncate text-xs text-zinc-500">{syllabus.url}</p></div><a href={syllabus.download_url ?? syllabus.url} target="_blank" rel="noreferrer" aria-label={`Open ${syllabus.version}`} className="text-blue-600"><ExternalLink size={17}/></a></li>)}</ul> : <p className="rounded-xl border border-rose-50 bg-neutral-50 p-3 text-sm text-zinc-500">No syllabus has been added.</p>}</section>
      </div>
      <p className="mt-6 rounded-3xl border border-blue-500 bg-blue-500/10 p-3 text-sm text-blue-600">Training can record which syllabus version it uses. Existing versions are kept when a new one is added.</p>
    </aside>
  </div>;
}
