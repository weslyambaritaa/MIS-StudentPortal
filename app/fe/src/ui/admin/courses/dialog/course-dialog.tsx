"use client";

import { useState, type FormEvent } from "react";
import { FileUp, Info, Link2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";

export type CourseSyllabus = { id: string; url: string; download_url?: string | null; version: string; created_at?: string };
export type CoursePracticeFile = { id: string; name: string; url: string; download_url?: string | null; source_type: "URL" | "UPLOAD"; created_at?: string };
export type CourseValue = {
  id: string; course_code: string; name: string; category_id: string; category_name: string;
  duration_minutes: number; duration_days?: number; level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  status: "ACTIVE" | "INACTIVE"; latest_syllabus: CourseSyllabus | null; syllabus_version_count: number;
  syllabuses?: CourseSyllabus[];
  practice_files?: CoursePracticeFile[];
};
export type CoursePayload = {
  courseCode: string; name: string; categoryId: string; durationDays: number;
  level: CourseValue["level"]; status?: CourseValue["status"];
  syllabus?: { kind: "URL"; url: string } | { kind: "UPLOAD"; fileName: string; contentBase64: string };
  practiceFilesToAdd?: Array<{ kind: "URL"; url: string } | { kind: "UPLOAD"; file: File }>;
  practiceFileIdsToRemove?: string[];
};
type CategoryOption = { id: string; name: string; category_code: string };
type PracticeDraft = { key: string; kind: "UPLOAD"; file: File } | { key: string; kind: "URL"; url: string; name: string };

export async function fileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read this file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      if (comma < 0) reject(new Error("Invalid file data."));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function CourseDialog({ value, categories, busy, error, onClose, onSubmit }: {
  value: CourseValue | null; categories: CategoryOption[]; busy: boolean; error: string | null;
  onClose: () => void; onSubmit: (payload: CoursePayload) => void;
}) {
  const [courseCode, setCourseCode] = useState(value?.course_code ?? "");
  const [name, setName] = useState(value?.name ?? "");
  const [categoryId, setCategoryId] = useState(value?.category_id ?? "");
  const [durationDays, setDurationDays] = useState(String(value?.duration_days ?? Math.max(1, Math.ceil((value?.duration_minutes ?? 480) / 480))));
  const [level, setLevel] = useState<CourseValue["level"]>(value?.level ?? "BEGINNER");
  const [status, setStatus] = useState<CourseValue["status"]>(value?.status ?? "ACTIVE");
  const [syllabusKind, setSyllabusKind] = useState<"UPLOAD" | "URL">("UPLOAD");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [practiceKind, setPracticeKind] = useState<"UPLOAD" | "URL">("UPLOAD");
  const [practiceDrafts, setPracticeDrafts] = useState<PracticeDraft[]>([]);
  const [practiceUrl, setPracticeUrl] = useState("");
  const [removedPracticeFileIds, setRemovedPracticeFileIds] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const addPracticeFiles = (files: File[]) => {
    const oversized = files.filter(item => item.size > 10 * 1024 * 1024);
    if (oversized.length) setLocalError(`These files exceed the 10 MB per-file limit: ${oversized.map(item => item.name).join(", ")}.`);
    else setLocalError(null);
    const accepted = files.filter(item => item.size <= 10 * 1024 * 1024);
    if (accepted.length) setPracticeDrafts(items => [...items, ...accepted.map(file => ({ key: crypto.randomUUID(), kind: "UPLOAD" as const, file }))]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLocalError(null);
    let syllabus: CoursePayload["syllabus"];
    if (syllabusKind === "UPLOAD" && file) {
      if (file.size > 10 * 1024 * 1024) { setLocalError("PDF size must be 10 MB or less."); return; }
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setLocalError("Choose a PDF file."); return; }
      try { syllabus = { kind: "UPLOAD", fileName: file.name, contentBase64: await fileAsBase64(file) }; }
      catch (cause) { setLocalError(cause instanceof Error ? cause.message : "Unable to read the PDF."); return; }
    } else if (syllabusKind === "URL" && url.trim()) syllabus = { kind: "URL", url: url.trim() };
    const practiceFilesToAdd: NonNullable<CoursePayload["practiceFilesToAdd"]> = practiceDrafts.map(item => item.kind === "URL" ? { kind: "URL", url: item.url } : { kind: "UPLOAD", file: item.file });
    onSubmit({ courseCode: courseCode.trim(), name: name.trim(), categoryId, durationDays: Number(durationDays), level, ...(value ? { status } : {}), ...(syllabus ? { syllabus } : {}), ...(practiceFilesToAdd.length ? { practiceFilesToAdd } : {}), ...(removedPracticeFileIds.length ? { practiceFileIdsToRemove: removedPracticeFileIds } : {}) });
  };

  const addPracticeUrl = () => {
    const trimmed = practiceUrl.trim();
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
      const pathPart = parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.hostname;
      let name = pathPart;
      try { name = decodeURIComponent(pathPart); } catch { /* Keep the encoded URL path as a readable fallback. */ }
      setPracticeDrafts(items => [...items, { key: crypto.randomUUID(), kind: "URL", url: parsed.toString(), name }]);
      setPracticeUrl(""); setLocalError(null);
    } catch { setLocalError("Enter a valid HTTP or HTTPS Practice File URL."); }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form role="dialog" aria-modal="true" aria-labelledby="course-dialog-title" onSubmit={event => void submit(event)} className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-rose-50 bg-white p-5 shadow-xl">
      <header className="mb-6 flex items-start justify-between"><h2 id="course-dialog-title" className="text-2xl font-medium text-gray-600">{value ? "Edit Course" : "Add Course"}</h2><IconButton label="Close" icon={<X size={18} />} onClick={onClose} disabled={busy} /></header>
      {(error || localError) && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{localError ?? error}</p>}
      <label className="mb-4 block text-sm text-gray-600">Course Code *<input required maxLength={50} value={courseCode} onChange={event => setCourseCode(event.target.value)} placeholder="Example: CRS-PY-02" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3" /></label>
      <label className="mb-4 block text-sm text-gray-600">Course Name *<input autoFocus={!value} required maxLength={150} value={name} onChange={event => setName(event.target.value)} placeholder="Example: Python for Data Science" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3" /></label>
      <label className="mb-4 block text-sm text-gray-600">Category *<select required value={categoryId} onChange={event => setCategoryId(event.target.value)} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3"><option value="">Pick a Category</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="mb-4 block text-sm text-gray-600">Duration *<span className="mt-1 flex h-9 overflow-hidden rounded-full border border-rose-600 bg-neutral-50"><input required type="number" min={1} max={365} step={1} value={durationDays} onChange={event => setDurationDays(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 outline-none"/><span className="flex items-center px-3 text-sm text-gray-500">Days</span></span></label>
      <label className="mb-4 block text-sm text-gray-600">Course Level *<select required value={level} onChange={event => setLevel(event.target.value as CourseValue["level"])} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3"><option value="BEGINNER">Fundamental</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></label>
      {value && <label className="mb-4 block text-sm text-gray-600">Status *<select value={status} onChange={event => setStatus(event.target.value as CourseValue["status"])} className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>}
      <section className="mb-6 rounded-xl bg-white p-3">
        <h3 className="mb-2 text-sm text-gray-600">Syllabus</h3>
        <div className="mb-3 flex rounded-full border border-rose-600 bg-neutral-50 p-1">
          <button type="button" onClick={() => setSyllabusKind("UPLOAD")} className={`flex h-8 flex-1 items-center justify-center gap-2 rounded-full px-3 text-xs font-medium ${syllabusKind === "UPLOAD" ? "bg-gradient-to-r from-red-400 to-rose-600 text-white" : "text-rose-600"}`}><FileUp size={16}/>Upload Syllabus</button>
          <button type="button" onClick={() => setSyllabusKind("URL")} className={`flex h-8 flex-1 items-center justify-center gap-2 rounded-full px-3 text-xs font-medium ${syllabusKind === "URL" ? "bg-gradient-to-r from-red-400 to-rose-600 text-white" : "text-rose-600"}`}><Link2 size={16}/>Via URL</button>
        </div>
        {syllabusKind === "UPLOAD" ? <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-rose-600 bg-neutral-50 p-5 text-center text-sm text-gray-600"><span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-r from-red-400 to-rose-600 text-white"><FileUp size={19}/></span><span>{file ? file.name : "Drag / Drop files here or Choose files from Computer"}</span><input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={event => setFile(event.target.files?.[0] ?? null)} /><span className="text-xs text-zinc-500">PDF, maximum 10 MB</span></label> : <label className="block text-sm text-gray-600">Syllabus URL<input type="url" maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/syllabus.pdf" className="mt-1 h-9 w-full rounded-full border border-rose-600 bg-neutral-50 px-3" /></label>}
        {value?.latest_syllabus && <p className="mt-3 break-all text-xs text-zinc-500">Current latest: <a href={value.latest_syllabus.download_url ?? value.latest_syllabus.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{value.latest_syllabus.version}</a>. Adding a syllabus will create a new version and keep older versions.</p>}
      </section>
      <section className="mb-6 rounded-xl bg-white p-3">
        <h3 className="mb-2 text-sm text-gray-600">Practice File</h3>
        <div className="mb-3 flex rounded-full border border-rose-600 bg-neutral-50 p-1">
          <button type="button" onClick={() => setPracticeKind("UPLOAD")} className={`flex h-8 flex-1 items-center justify-center gap-2 rounded-full px-3 text-xs font-medium ${practiceKind === "UPLOAD" ? "bg-gradient-to-r from-red-400 to-rose-600 text-white" : "text-rose-600"}`}><FileUp size={16}/>Upload File</button>
          <button type="button" onClick={() => setPracticeKind("URL")} className={`flex h-8 flex-1 items-center justify-center gap-2 rounded-full px-3 text-xs font-medium ${practiceKind === "URL" ? "bg-gradient-to-r from-red-400 to-rose-600 text-white" : "text-rose-600"}`}><Link2 size={16}/>Via URL</button>
        </div>
        {practiceKind === "UPLOAD" ? <label onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addPracticeFiles(Array.from(event.dataTransfer.files)); }} className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-rose-600 bg-neutral-50 p-5 text-center text-sm text-gray-600"><span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-r from-red-400 to-rose-600 text-white"><FileUp size={19}/></span><span>Drag / Drop files here or Choose files from Computer</span><input type="file" multiple className="sr-only" onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; addPracticeFiles(files); }} /><span className="text-xs text-zinc-500">Multiple files, maximum 10 MB each</span></label> : <div className="flex gap-2"><input type="url" maxLength={2048} value={practiceUrl} onChange={event => setPracticeUrl(event.target.value)} placeholder="https://example.com/practice-file" className="h-9 min-w-0 flex-1 rounded-full border border-rose-600 bg-neutral-50 px-3 text-sm"/><Button type="button" size="sm" onClick={addPracticeUrl} disabled={!practiceUrl.trim()}><Plus size={16}/>Add URL</Button></div>}
        {(value?.practice_files?.length || practiceDrafts.length) ? <ul className="mt-3 space-y-2">
          {value?.practice_files?.map(file => {
            const removed = removedPracticeFileIds.includes(file.id);
            return <li key={file.id} className={`flex min-w-0 items-center gap-2 rounded-xl border border-rose-50 bg-neutral-50 p-2 text-sm ${removed ? "opacity-50" : ""}`}><a className="min-w-0 flex-1 truncate text-gray-700 underline" href={file.download_url ?? file.url} target="_blank" rel="noreferrer">{file.name}</a><button type="button" className="text-xs font-medium text-rose-600" onClick={() => setRemovedPracticeFileIds(ids => removed ? ids.filter(id => id !== file.id) : [...ids, file.id])}>{removed ? "Undo" : "Remove"}</button></li>;
          })}
          {practiceDrafts.map(item => <li key={item.key} className="flex min-w-0 items-center gap-2 rounded-xl border border-rose-50 bg-neutral-50 p-2 text-sm"><span className="min-w-0 flex-1 truncate text-gray-700">{item.kind === "UPLOAD" ? item.file.name : item.name}</span><span className="shrink-0 text-xs text-emerald-700">Ready</span><button type="button" aria-label={`Remove ${item.kind === "UPLOAD" ? item.file.name : item.name}`} className="text-rose-600" onClick={() => setPracticeDrafts(items => items.filter(draft => draft.key !== item.key))}><Trash2 size={16}/></button></li>)}
        </ul> : <p className="mt-3 text-xs text-zinc-500">No Practice File added.</p>}
      </section>
      {!value && <div className="mb-6 flex gap-2 rounded-3xl border border-blue-500 bg-blue-500/10 p-3 text-sm text-blue-600"><Info size={18} className="shrink-0"/><span>A PDF is stored in Cloudinary. Previous syllabus versions remain available for Training to select.</span></div>}
      <footer className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" rightIcon="plus" disabled={busy || !courseCode.trim() || !name.trim() || !categoryId || !Number(durationDays)}>{busy ? "Saving…" : value ? "Save Course" : "Add Course"}</Button></footer>
    </form>
  </div>;
}
