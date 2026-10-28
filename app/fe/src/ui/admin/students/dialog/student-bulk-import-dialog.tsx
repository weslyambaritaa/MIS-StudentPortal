"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Info, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";
import { Modal } from "@mis/ui/modal";
import { Pagination } from "@mis/ui/pagination";
import { useToast } from "@mis/ui/toast";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 1000;
const PAGE_SIZE = 8;

type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
type ImportRow = { rowNumber: number; name: string; email: string; accountName: string; companyRole: string };
type PreviewItem = ImportRow & { accountId?: string; errors: string[]; status?: "CREATED" | "REJECTED"; studentId?: string };
type PreviewResult = { items: PreviewItem[]; total: number; validCount: number; rejectedCount: number };
type ImportResult = { items: PreviewItem[]; total: number; createdCount: number; rejectedCount: number };

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function templateFile() {
  const workbook = XLSX.utils.book_new();
  const students = XLSX.utils.aoa_to_sheet([["Student Name", "Email", "Account", "Student Company Role"]]);
  students["!cols"] = [{ wch: 26 }, { wch: 34 }, { wch: 32 }, { wch: 28 }];
  const example = XLSX.utils.aoa_to_sheet([
    ["Student Name", "Email", "Account", "Student Company Role"],
    ["Sari Dewi", "sari.dewi@example.com", "PT Nusantara Digital", "Product Manager"],
  ]);
  example["!cols"] = students["!cols"];
  XLSX.utils.book_append_sheet(workbook, students, "Students");
  XLSX.utils.book_append_sheet(workbook, example, "Example");
  XLSX.writeFile(workbook, "student-batch-template.xlsx");
}

async function readStudentFile(file: File): Promise<ImportRow[]> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Please select an .xlsx file.");
  if (file.size > MAX_FILE_BYTES) throw new Error("The file must be 10 MB or smaller.");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = workbook.SheetNames.includes("Students") ? "Students" : workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a worksheet.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
  if (matrix.length < 2) throw new Error("The worksheet must include column headers and at least one Student row.");

  const headers = (matrix[0] ?? []).map(normalizeHeader);
  const column = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const nameIndex = column(["studentname", "name"]);
  const emailIndex = column(["email", "studentemail"]);
  const accountIndex = column(["account", "accountname"]);
  const roleIndex = column(["studentcompanyrole", "companyrole", "role"]);
  const missing = [nameIndex < 0 && "Student Name", emailIndex < 0 && "Email", accountIndex < 0 && "Account"].filter(Boolean);
  if (missing.length) throw new Error(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template for the correct format.`);

  const rows: ImportRow[] = [];
  for (let index = 1; index < matrix.length; index += 1) {
    const cells = matrix[index] ?? [];
    const values = [nameIndex, emailIndex, accountIndex, roleIndex].map((cellIndex) => cellIndex < 0 ? "" : String(cells[cellIndex] ?? "").trim());
    if (values.every((value) => !value)) continue;
    rows.push({ rowNumber: index + 1, name: values[0], email: values[1], accountName: values[2], companyRole: values[3] });
    if (rows.length > MAX_ROWS) throw new Error(`The file exceeds the maximum of ${MAX_ROWS} Student rows.`);
  }
  if (!rows.length) throw new Error("No Student rows found in the worksheet.");
  return rows;
}

export function StudentBulkImportDialog({ api, onClose, onComplete }: { api: ApiRequest; onClose: () => void; onComplete: () => void }) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentItems = result?.items ?? preview?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(currentItems.length / PAGE_SIZE));
  const displayedItems = useMemo(() => currentItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [currentItems, page]);

  const selectFile = async (file?: File) => {
    if (!file) return;
    setError(null); setPreview(null); setResult(null); setRows([]); setPage(1); setBusy(true);
    try {
      const parsedRows = await readStudentFile(file);
      setRows(parsedRows); setFileName(file.name);
    } catch (cause) {
      setFileName(""); setError(cause instanceof Error ? cause.message : "Could not read this workbook.");
    } finally { setBusy(false); }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files[0]);
  };

  const loadPreview = async () => {
    setBusy(true); setError(null);
    try {
      const response = await api<PreviewResult>("/api/v1/internal/students/bulk-preview", { method: "POST", body: JSON.stringify({ rows }) });
      setPreview(response); setPage(1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Student validation failed."); }
    finally { setBusy(false); }
  };

  const commitImport = async () => {
    setBusy(true); setError(null);
    try {
      const response = await api<ImportResult>("/api/v1/internal/students/bulk-import", { method: "POST", body: JSON.stringify({ rows }) });
      showToast(`Import completed: ${response.createdCount} students added; ${response.rejectedCount} rows rejected.`);
      setResult(response); setPreview(null); setPage(1); onComplete();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Student import failed."); }
    finally { setBusy(false); }
  };

  const isResult = Boolean(result);
  const isPreview = Boolean(preview);

  return <Modal open onClose={() => { if (!busy) onClose(); }} className="max-h-[calc(100vh-2rem)] max-w-[902px] overflow-y-auto">
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-medium text-gray-600">{isResult ? "Student Import Result" : isPreview ? "Student List Preview" : "Upload Batch Student"}</h2>
        {isPreview && <p className="mt-2 text-sm text-zinc-600">Upload Batch <span className="text-rose-600">/ Student Preview</span></p>}
        {isResult && <p className="mt-2 text-sm text-zinc-600">Upload Batch <span className="text-rose-600">/ Import Result</span></p>}
      </div>
      <IconButton label="Close" icon={<X size={18}/>} disabled={busy} onClick={onClose}/>
    </header>

    {!isResult && <div className="mb-6 rounded-3xl border border-blue-500 bg-blue-500/10 p-3 text-sm">
      <div className="flex items-center gap-1 font-medium text-blue-600"><Info size={18}/>Upload With Portal Account</div>
      <p className="mt-2 text-slate-600">An activation email is sent only after you confirm the import. The preview does not create accounts or send email.</p>
      <p className="mt-2 text-blue-600 underline">Student portal activation email template</p>
    </div>}

    {!isPreview && !isResult && <section className="mb-6">
      <div className="mb-1 text-sm text-gray-600">Excel Student Batch (.xlsx)</div>
      <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} className={`flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center ${dragging ? "border-rose-600 bg-rose-50" : "border-rose-600 bg-neutral-50"}`}>
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-gradient-to-b from-red-400 to-rose-600 text-white"><Upload size={20}/></div>
        <p className="text-sm text-gray-600">Drag and drop a file here, or <button type="button" className="text-rose-600" onClick={() => inputRef.current?.click()}>choose a file</button></p>
        {fileName && <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-gray-700"><FileSpreadsheet size={16} className="text-green-600"/>{fileName}</p>}
        <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => void selectFile(event.target.files?.[0])}/>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600"><span>(Excel .xlsx), maximum file size 10 MB and {MAX_ROWS} Student rows.</span><button type="button" onClick={templateFile} className="inline-flex items-center gap-1 font-medium text-rose-600 hover:underline"><Download size={16}/>Download template</button></div>
    </section>}

    {(isPreview || isResult) && <section className="mb-6">
      <div className="mb-3 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-green-500/10 px-3 py-1 text-green-700"><CheckCircle2 size={15} className="mr-1 inline"/>{isResult ? result?.createdCount : preview?.validCount} valid</span>
        <span className="rounded-full bg-red-500/10 px-3 py-1 text-red-600"><AlertCircle size={15} className="mr-1 inline"/>{isResult ? result?.rejectedCount : preview?.rejectedCount} rejected</span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-zinc-600">{isResult ? result?.total : preview?.total} total</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-rose-50">
        <div className="grid grid-cols-[1.1fr_1fr_1.1fr_1fr_1.3fr] gap-3 bg-neutral-100 p-3 text-xs font-semibold text-gray-600"><span>NAME</span><span>ACCOUNT</span><span>EMAIL</span><span>ROLE</span><span>{isResult ? "RESULT" : "VALIDATION"}</span></div>
        <div className="max-h-[45vh] overflow-y-auto">
          {displayedItems.map((item) => <div key={`${item.rowNumber}-${item.email}`} className="grid grid-cols-[1.1fr_1fr_1.1fr_1fr_1.3fr] gap-3 border-t border-rose-50 p-3 text-sm text-zinc-700">
            <span className="min-w-0 break-words">{item.name || "Ã¢â‚¬â€"}<span className="block text-xs text-zinc-400">Row {item.rowNumber}</span></span>
            <span className="min-w-0 break-words">{item.accountName || "Ã¢â‚¬â€"}</span>
            <span className="min-w-0 break-all">{item.email || "Ã¢â‚¬â€"}</span>
            <span className="min-w-0 break-words">{item.companyRole || "Ã¢â‚¬â€"}</span>
            {isResult ? <span className={item.status === "CREATED" ? "text-green-700" : "text-red-600"}>{item.status === "CREATED" ? "Created; activation email sent" : item.errors.join(" ")}</span> : <span className={item.errors.length ? "text-red-600" : "text-green-700"}>{item.errors.length ? item.errors.join(" ") : "Ready to import"}</span>}
          </div>)}
        </div>
      </div>
      <div className="mt-3"><Pagination page={page} totalPages={totalPages} pageSize={displayedItems.length} totalItems={currentItems.length} onPageChange={setPage}/></div>
    </section>}

    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

    <footer className="flex justify-end gap-3">
      {isResult ? <Button type="button" onClick={onClose}>Close</Button> : isPreview ? <>
        <Button type="button" variant="ghost" onClick={() => { setPreview(null); setPage(1); }} disabled={busy}>Back</Button>
        <Button type="button" onClick={() => void commitImport()} disabled={busy || !preview?.validCount}>{busy ? "Importing and sending emailÃ¢â‚¬Â¦" : "Upload Batch"}</Button>
      </> : <>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="button" onClick={() => void loadPreview()} disabled={busy || !rows.length}>{busy ? "ReadingÃ¢â‚¬Â¦" : "Continue"}</Button>
      </>}
    </footer>
  </Modal>;
}
