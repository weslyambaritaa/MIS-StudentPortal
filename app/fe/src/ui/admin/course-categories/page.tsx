"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@mis/ui/button";
import { DeleteConfirmationModal } from "@mis/ui/delete-confirmation-modal";
import { IconButton } from "@mis/ui/icon-button";
import { Pagination } from "@mis/ui/pagination";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@mis/ui/toast";
import { CourseCategoryDialog, type CourseCategoryFormValue } from "./dialog/course-category-dialog";

type CourseCategory = CourseCategoryFormValue & { id: string; category_code: string; amount_courses: number | string };
type CourseCategoryList = { items: CourseCategory[]; page: number; pageSize: number; total: number };

export default function CourseCategoryPage() {
  const api = useApi();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CourseCategoryList>({ items: [], page: 1, pageSize: 8, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<CourseCategoryFormValue | null>(null);
  const [deleting, setDeleting] = useState<CourseCategory | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "8" });
      if (search) query.set("search", search);
      setResult(await api<CourseCategoryList>(`/api/v1/internal/course-categories?${query}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load Course Categories");
    } finally { setLoading(false); }
  }, [api, page, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timeout = window.setTimeout(() => { setPage(1); setSearch(draftSearch.trim()); }, 250);
    return () => window.clearTimeout(timeout);
  }, [draftSearch]);

  const save = async (value: { name: string }) => {
    setBusy(true); setError(null);
    try {
      const id = editor?.id;
      await api(`/api/v1/internal/course-categories${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(value) });
      showToast(id ? "Course Category updated successfully." : "Course Category added successfully.");
      setEditor(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save Course Category");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError(null);
    try {
      await api(`/api/v1/internal/course-categories/${deleting.id}`, { method: "DELETE" });
      showToast("Course Category deleted successfully.");
      setDeleting(null);
      if (result.items.length === 1 && page > 1) setPage((value) => value - 1);
      else await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to delete Course Category");
      setDeleting(null);
    } finally { setBusy(false); }
  };

  return (
    <AppShell title="Master Data | Course Category">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col justify-between gap-4 rounded-3xl border border-rose-50 bg-white p-5 sm:flex-row sm:items-center">
          <div><h1 className="text-3xl font-medium text-gray-600">Course Category</h1><p className="mt-1 text-sm text-zinc-600">Manage category for courses here, one category can have multiple courses.</p></div>
          <Button leftIcon={<Plus size={18} />} onClick={() => setEditor({ name: "" })}>Add Category</Button>
        </section>

        <section className="rounded-3xl border border-rose-50 bg-white p-5">
          <div className="mb-6">
            <label htmlFor="course-category-search" className="flex w-full flex-col gap-[3px] text-sm text-gray-600 md:w-60">
              Search Category
              <span className="flex h-9 items-center gap-2 rounded-full border border-rose-600 bg-neutral-50 px-3">
                <Search size={20} className="shrink-0 text-slate-900/40" />
                <input id="course-category-search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Search code or category name" className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-900/40" />
              </span>
            </label>
          </div>

          {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="overflow-x-auto rounded-xl border border-rose-50">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-100 text-xs font-medium uppercase text-gray-600"><tr><th className="px-3 py-3">Code</th><th className="px-3 py-3">Category Name</th><th className="px-3 py-3">Amount Courses</th><th className="px-3 py-3">Action</th></tr></thead>
              <tbody>
                {!loading && result.items.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-zinc-500">No Course Categories found.</td></tr>}
                {result.items.map((category) => {
                  const inUse = Number(category.amount_courses) > 0;
                  return <tr key={category.id} className="border-t border-rose-50 text-zinc-700">
                    <td className="px-3 py-3 font-medium">{category.category_code}</td><td className="px-3 py-3">{category.name}</td><td className="px-3 py-3">{Number(category.amount_courses)}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1"><IconButton label={`Edit ${category.name}`} icon={<Pencil size={17} />} size="sm" onClick={() => setEditor(category)} /><IconButton label={`Delete ${category.name}`} icon={<Trash2 size={17} />} variant="danger" size="sm" onClick={() => {
                    if (inUse) {
                      setError("Cannot delete this Course Category because it has associated Courses.");
                      return;
                    }
                    setError(null);
                    setDeleting(category);
                  }} /></div></td>
                  </tr>;
                })}
                {loading && <tr><td colSpan={4} className="px-3 py-10 text-center text-zinc-500">Loading Course Categories…</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-4 w-full"><Pagination page={page} totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))} pageSize={result.items.length} totalItems={result.total} onPageChange={setPage} /></div>
        </section>
      </div>
      {editor && <CourseCategoryDialog value={editor} busy={busy} onClose={() => setEditor(null)} onSubmit={save} />}
      <DeleteConfirmationModal open={Boolean(deleting)} itemName={deleting?.name ?? ""} description={`Course Category “${deleting?.name ?? ""}” will be permanently deleted.`} onClose={() => setDeleting(null)} onConfirm={() => void remove()} loading={busy} />
    </AppShell>
  );
}
