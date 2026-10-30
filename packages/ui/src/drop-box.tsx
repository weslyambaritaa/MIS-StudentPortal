"use client";

import { Download, FileText, Trash2, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

import { IconButton } from "./icon-button";

type DropBoxProps = {
  label?: string | null;
  description?: string;
  file?: File | null;
  onFileChange?: (file: File | null) => void;
  multiple?: boolean;
  onFilesChange?: (files: File[]) => void;
  showFilePreview?: boolean;
  dropMessage?: ReactNode;
  icon?: ReactNode;
  dropzoneClassName?: string;
  accept?: string;
};

export function DropBox({
  label = "Label",
  description = "Description",
  file,
  onFileChange,
  multiple = false,
  onFilesChange,
  showFilePreview = true,
  dropMessage,
  icon,
  dropzoneClassName = "flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border p-6 text-center",
  accept,
}: DropBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const downloadFile = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-sm text-gray-600">{label}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(event) => {
          const selectedFiles = Array.from(event.target.files ?? []);
          if (multiple) onFilesChange?.(selectedFiles);
          else onFileChange?.(selectedFiles[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
      {!file || !showFilePreview || multiple ? (
        <button
          type="button"
          className={`${dropzoneClassName} ${dragging ? "border-rose-600 bg-rose-50" : "border-rose-600 bg-neutral-50"}`}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragging(false);
            const droppedFiles = Array.from(event.dataTransfer.files);
            if (multiple) onFilesChange?.(droppedFiles);
            else onFileChange?.(droppedFiles[0] ?? null);
          }}
        >
          <span className="flex size-10 items-center justify-center rounded-[100px] bg-radial-[at_50%_0%] from-red-400 to-rose-600 text-white">
            {icon ?? <Upload size={20} />}
          </span>
          {dropMessage ?? <span className="text-sm text-gray-600">
            Tarik / Lepaskan file disini atau{" "}
            <span className="text-rose-600">Pilih file Dari Komputer</span>
          </span>}
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3">
          <FileText className="shrink-0 text-gray-600" size={20} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium text-gray-600">{file.name}</p>
            <p className="text-sm font-medium text-rose-600">
              {(file.size / 1024 / 1024).toFixed(1)}Mb
            </p>
          </div>
          <IconButton
            label="Download file"
            variant="primary"
            icon={<Download size={18} />}
            onClick={downloadFile}
          />
          <IconButton
            label="Remove file"
            variant="danger"
            icon={<Trash2 size={18} />}
            onClick={() => {
              onFileChange?.(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </div>
      )}
      {description && <span className="text-sm text-zinc-950/60">{description}</span>}
    </div>
  );
}
