"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useApi } from "@/hooks/use-api";

type Item = { id: string; status: string; form_type?: "REQUEST" | "REGISTRATION"; account_name: string; pic_name: string; quotation_code: string | null; po_reference: string | null; course_count: number; created_at: string; updated_at: string };
type Detail = { item: Item & { review_note?: string | null }; courses: Array<Record<string, unknown>>; attachments: Array<{ id: string; file_name: string; download_url: string }> };
const deliveryLabel = (value: unknown) => ({ INHOUSE: "In-house", ONLINE_PUBLIC: "Online Public", ONLINE_PRIVATE: "Online Private" } as Record<string, string>)[String(value)] ?? String(value);
function formatDates(values: string[]) {
  const sorted = [...new Set(values.filter(Boolean))].sort();
  if (!sorted.length) return "Schedule not set";
  const grouped = new Map<string, number[]>();
  for (const value of sorted) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    grouped.set(key, [...(grouped.get(key) ?? []), day]);
  }
  const years = new Set([...grouped.keys()].map((key) => key.slice(0, 4)));
  return `${[...grouped.entries()].map(([key, days]) => {
    const [year, month] = key.split("-").map(Number); const ranges: string[] = [];
    for (let i = 0; i < days.length;) { let end = i; while (end + 1 < days.length && days[end + 1] === days[end] + 1) end += 1; ranges.push(end > i ? `${days[i]}–${days[end]}` : String(days[i])); i = end + 1; }
    const monthName = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(year, month - 1, 1));
    return `${ranges.join(", ")} ${monthName}${years.size > 1 ? ` ${year}` : ""}`;
  }).join(", ")}${years.size === 1 ? ` ${[...years][0]}` : ""}`;
}

export default function RequestFormReviewPage() {
  const api = useApi();
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await api<{ items: Item[]; total: number }>(`/api/v1/internal/request-form-review?page=${page}&pageSize=8`);
      setItems(result.items); setTotal(result.total); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load request forms"); }
  }, [api, page]);
  useEffect(() => { void load(); }, [load]);
  async function open(id: string) { try { setDetail(await api<Detail>(`/api/v1/internal/request-form-review/${id}`)); setNote(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not load request details"); } }
  async function review(action: "approve" | "return") {
    if (!detail || (action === "return" && !note.trim())) return;
    setBusy(true); setError("");
    try {
      await api(`/api/v1/internal/request-form-review/${detail.item.id}/${action}`, { method: "PATCH", body: JSON.stringify(action === "return" ? { note } : {}) });
      setDetail(null); setNote(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : `Could not ${action} request form`); }
    finally { setBusy(false); }
  }
  return <AppShell title="Request Form Review"><div className="space-y-5">
    <section className="rounded-3xl border border-rose-50 bg-white p-5"><h1 className="text-2xl font-medium text-gray-700">Request Form Review</h1><p className="mt-1 text-sm text-zinc-950/60">Review Sales submissions, approve them, or return them with a required revision note.</p></section>
    <section className="space-y-4 rounded-3xl border border-rose-50 bg-white p-5"><h2 className="font-medium">Waiting for QPD</h2>{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-neutral-100"><tr>{["Form", "Account", "PIC", "Quotation / PO", "Courses", "Submitted", "Action"].map((v) => <th className="p-3" key={v}>{v}</th>)}</tr></thead><tbody>
        {items.map((item) => <tr className="border-b" key={item.id}><td className="p-3">{item.form_type === "REGISTRATION" ? "Registration" : "Request"}</td><td className="p-3">{item.account_name}</td><td className="p-3">{item.pic_name}</td><td className="p-3">{item.quotation_code ?? item.po_reference ?? "—"}</td><td className="p-3">{item.course_count}</td><td className="p-3">{new Date(item.updated_at ?? item.created_at).toLocaleDateString("id-ID")}</td><td className="p-3"><Button size="sm" onClick={() => void open(item.id)}>Review</Button></td></tr>)}
        {!items.length && <tr><td className="p-8 text-center text-gray-500" colSpan={7}>No forms waiting for review.</td></tr>}
      </tbody></table></div>
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / 8))} pageSize={items.length} totalItems={total} onPageChange={setPage} />
    </section>
  </div>
  {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[92vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-3xl bg-white p-5">
    <div className="flex justify-between"><h2 className="text-2xl font-medium">{detail.item.form_type === "REGISTRATION" ? "Registration Form" : "Request Form"} Details</h2><button onClick={() => setDetail(null)} aria-label="Close">×</button></div>
    <p className="text-sm text-zinc-950/60">{detail.item.account_name} · {detail.item.pic_name} · {detail.item.quotation_code ?? detail.item.po_reference ?? "Without quotation"}</p>
    <h3 className="font-medium text-rose-600">Course Details</h3>{detail.courses.map((course) => <article className="space-y-1 rounded-xl bg-neutral-50 p-3" key={String(course.id)}><b>{String(course.course_name)}</b><p>{String(course.amount_student)} students · {deliveryLabel(course.delivery_type)} · {String(course.service_type)} · {String(course.language)}</p><p className="text-sm">{formatDates((course.sessions as Array<Record<string, string>>).map((s) => String(s.date).slice(0, 10)))}</p><p className="text-sm">Room rental: {course.room_rental === null ? "Not specified" : course.room_rental ? `${String(course.room_pc ?? "PC not selected")} ${(course.room_services as string[]).join(", ")}` : "No"}</p>{course.special_instruction ? <p className="text-sm">Notes: {String(course.special_instruction)}</p> : null}</article>)}
    <h3 className="font-medium text-rose-600">Attachments</h3>{detail.attachments.length ? detail.attachments.map((a) => <p key={a.id}><a className="text-rose-600 underline" href={a.download_url} target="_blank" rel="noreferrer">{a.file_name}</a></p>) : <p className="text-sm text-zinc-950/60">No attachments</p>}
    <label className="block text-sm font-medium">Revision note (required to return)<textarea className="mt-1 min-h-24 w-full rounded-xl border p-3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain what Sales needs to revise" /></label>
    <div className="flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setDetail(null)}>Close</Button><Button variant="soft" disabled={busy || !note.trim()} onClick={() => void review("return")}>{busy ? "Saving…" : "Return for Revision"}</Button><Button disabled={busy} onClick={() => void review("approve")}>{busy ? "Saving…" : "Approve"}</Button></div>
  </div></div>}
  </AppShell>;
}
