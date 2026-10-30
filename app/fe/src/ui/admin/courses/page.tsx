"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@mis/ui/badge";
import { Button, AddButton } from "@mis/ui/button";
import { DataTable, type DataTableColumn } from "@mis/ui/data-table";
import { DeleteConfirmationModal } from "@mis/ui/delete-confirmation-modal";
import { IconButton } from "@mis/ui/icon-button";
import { Pagination } from "@mis/ui/pagination";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@mis/ui/toast";
import { CourseDialog, fileAsBase64, type CoursePayload, type CourseValue } from "./dialog/course-dialog";
import { CourseDetailsDialog } from "./dialog/course-details-dialog";

type Category = { id: string; category_code: string; name: string };
type CourseList = { items: CourseValue[]; page: number; pageSize: number; total: number };
const EMPTY: CourseList = { items: [], page: 1, pageSize: 8, total: 0 };
const categoryLabel = (level: CourseValue["level"]) => level === "BEGINNER" ? "Fundamental" : level === "ADVANCED" ? "Advanced" : "Intermediate";

export default function CoursesPage() {
  const api = useApi();
  const { showToast } = useToast();
  const [result, setResult] = useState<CourseList>(EMPTY);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [level, setLevel] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editor, setEditor] = useState<CourseValue | null | undefined>(undefined);
  const [selected, setSelected] = useState<CourseValue | null>(null);
  const [deleting, setDeleting] = useState<CourseValue | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "8", categoryId, level, status });
      if (search) query.set("search", search);
      setResult(await api<CourseList>(`/api/v1/internal/courses?${query}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load Courses"); }
    finally { setLoading(false); }
  }, [api, page, categoryId, level, status, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setSearch(draftSearch.trim()); }, 250); return () => window.clearTimeout(timer); }, [draftSearch]);
  useEffect(() => { void api<{ items: Category[] }>("/api/v1/internal/course-categories?page=1&pageSize=100").then(response => setCategories(response.items)).catch(cause => setError(cause instanceof Error ? cause.message : "Failed to load Course Categories")); }, [api]);

  const save = async (payload: CoursePayload) => {
    setBusy(true); setDialogError(null);
    try {
      const id = editor && editor.id;
      const { practiceFilesToAdd = [], practiceFileIdsToRemove = [], ...coursePayload } = payload;
      const saved = await api<{ item: { id: string } }>(`/api/v1/internal/courses${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(coursePayload) });
      const courseId = saved.item.id;
      let practiceUpdateFailed = false;
      for (const fileId of practiceFileIdsToRemove) {
        try { await api(`/api/v1/internal/courses/${courseId}/practice-files/${fileId}`, { method: "DELETE" }); }
        catch { practiceUpdateFailed = true; }
      }
      for (const practiceFile of practiceFilesToAdd) {
        try {
          const body = practiceFile.kind === "URL" ? practiceFile : { kind: "UPLOAD", fileName: practiceFile.file.name, contentBase64: await fileAsBase64(practiceFile.file) };
          await api(`/api/v1/internal/courses/${courseId}/practice-files`, { method: "POST", body: JSON.stringify(body) });
        }
        catch { practiceUpdateFailed = true; }
      }
      showToast(practiceUpdateFailed ? "Course saved, but some Practice Files could not be updated. Reopen Edit Course and retry." : id ? "Course updated successfully." : "Course added successfully.");
      setEditor(undefined); await load();
    } catch (cause) { setDialogError(cause instanceof Error ? cause.message : "Failed to save Course"); }
    finally { setBusy(false); }
  };

  const openEditor = async (course: CourseValue) => {
    setDetailsLoading(true); setError(null);
    try { const response = await api<{ item: CourseValue }>(`/api/v1/internal/courses/${course.id}`); setEditor(response.item); setDialogError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load Course for editing"); }
    finally { setDetailsLoading(false); }
  };

  const openDetails = async (course: CourseValue) => {
    setSelected(course); setDetailsLoading(true);
    try { const response = await api<{ item: CourseValue }>(`/api/v1/internal/courses/${course.id}`); setSelected(response.item); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load Course details"); }
    finally { setDetailsLoading(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError(null);
    try {
      await api(`/api/v1/internal/courses/${deleting.id}`, { method: "DELETE" });
      showToast("Course deleted successfully.");
      setDeleting(null);
      if (result.items.length === 1 && page > 1) setPage(value => value - 1); else await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to delete Course"); setDeleting(null); }
    finally { setBusy(false); }
  };

  const columns: DataTableColumn<CourseValue>[] = [
    { key: "code", header: "CODE", render: row => <span className="font-medium text-zinc-700">{row.course_code}</span> },
    { key: "name", header: "COURSE NAME", render: row => <button onClick={() => void openDetails(row)} className="text-left font-medium text-rose-600 hover:underline">{row.name}</button> },
    { key: "category", header: "CATEGORY", render: row => row.category_name },
    { key: "duration", header: "DURATION", render: row => `${row.duration_days ?? Math.max(1, Math.ceil(row.duration_minutes / 480))} Days` },
    { key: "level", header: "LEVEL", render: row => categoryLabel(row.level) },
    { key: "syllabus", header: "SYLLABUS", render: row => row.latest_syllabus ? <span title={`${row.syllabus_version_count} version(s)`} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-300/20 px-3 py-1 text-xs font-medium text-amber-700">{row.latest_syllabus.version}{row.syllabus_version_count > 1 ? ` +${row.syllabus_version_count - 1}` : ""}</span> : <span className="text-zinc-400">—</span> },
    { key: "status", header: "STATUS", render: row => <Badge variant={row.status === "ACTIVE" ? "success" : "danger"} showDot>{row.status === "ACTIVE" ? "Active" : "Inactive"}</Badge> },
    { key: "actions", header: "ACTION", className: "whitespace-nowrap", render: row => <div className="flex items-center gap-1"><IconButton label={`View ${row.name}`} icon={<Eye size={17}/>} size="sm" onClick={() => void openDetails(row)}/><IconButton label={`Edit ${row.name}`} icon={<Pencil size={17}/>} size="sm" onClick={() => void openEditor(row)} disabled={detailsLoading}/><IconButton label={`Delete ${row.name}`} icon={<Trash2 size={17}/>} variant="danger" size="sm" onClick={() => setDeleting(row)}/></div> },
  ];

  return <AppShell title="Master Data | Course"><div className="flex flex-col gap-6">
    <section className="flex flex-col justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-medium text-gray-600">Course</h1><p className="mt-1 text-sm text-zinc-600">Manage master data for courses and their syllabus versions.</p></div><AddButton onClick={() => { setDialogError(null); setEditor(null); }}>Add Course</AddButton></section>
    <section className="rounded-3xl border border-rose-50 bg-white p-5"><div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <label className="flex w-full flex-col gap-[3px] text-sm text-gray-600 xl:w-60">Search Course<span className="flex h-9 items-center gap-2 rounded-full border border-rose-600 bg-neutral-50 px-3"><Search size={20} className="shrink-0 text-slate-900/40"/><input value={draftSearch} onChange={event => setDraftSearch(event.target.value)} placeholder="Example: Data & Analytics" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-900/40"/></span></label>
      <div className="flex flex-wrap gap-4"><label className="flex flex-col gap-[3px] text-sm text-gray-600">Category<select value={categoryId} onChange={event => { setPage(1); setCategoryId(event.target.value); }} className="h-9 w-44 rounded-full border border-rose-600 bg-neutral-50 px-3"><option value="ALL">All Category</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="flex flex-col gap-[3px] text-sm text-gray-600">Level<select value={level} onChange={event => { setPage(1); setLevel(event.target.value); }} className="h-9 w-44 rounded-full border border-rose-600 bg-neutral-50 px-3"><option value="ALL">All Level</option><option value="BEGINNER">Fundamental</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></label><label className="flex flex-col gap-[3px] text-sm text-gray-600">Status<select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }} className="h-9 w-40 rounded-full border border-rose-600 bg-neutral-50 px-3"><option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <div className="py-10 text-center text-zinc-500">Loading Courses…</div> : <DataTable columns={columns} rows={result.items} getRowKey={row => row.id} caption="Course list" emptyMessage="No Courses found."/>}
    <div className="mt-1"><Pagination page={page} totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))} pageSize={result.items.length} totalItems={result.total} onPageChange={setPage}/></div>
    </section></div>
    {editor !== undefined && <CourseDialog value={editor} categories={categories} busy={busy} error={dialogError} onClose={() => setEditor(undefined)} onSubmit={save}/>}
    {selected && <CourseDetailsDialog course={selected} loading={detailsLoading} onClose={() => setSelected(null)}/>}
    <DeleteConfirmationModal open={Boolean(deleting)} itemName={deleting?.name ?? ""} description={`Course “${deleting?.name ?? ""}” will be permanently deleted. Courses used by a Quotation or Training cannot be deleted; deactivate those courses instead.`} onClose={() => setDeleting(null)} onConfirm={() => void remove()} loading={busy}/>
  </AppShell>;
}
