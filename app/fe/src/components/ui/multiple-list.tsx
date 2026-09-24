"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

type MultipleListProps = {
  title: string;
  values: string[];
  details?: string[];
  placeholder?: string;
  detailPlaceholder?: string;

  onChange: (index: number, value: string) => void;
  onDetailChange?: (index: number, value: string) => void;

  onAdd: () => void;

  onRemove: (index: number) => void;
};

export function MultipleList({
  title,
  values,
  details,
  placeholder = "Placeholder",
  detailPlaceholder = "Placeholder",
  onChange,
  onDetailChange,
  onAdd,
  onRemove,
}: MultipleListProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-rose-600">{title}</h3>

        <Button size="sm" leftIcon={<Plus size={16} />} onClick={onAdd}>
          Add List
        </Button>
      </div>

      <div className="h-px w-full bg-zinc-950/20" />

      <div className="space-y-3">
        {values.map((value, index) => (
          <div key={index} className="flex items-end gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-[3px] text-sm text-gray-600">
              <span>List #{index + 1}</span>
              <input
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(index, event.target.value)}
                className="h-9 min-w-0 rounded-[100px] border border-rose-600 bg-neutral-50 px-3 text-sm outline-none placeholder:text-slate-900/40"
              />
            </label>
            {details && onDetailChange && (
              <label className="flex min-w-0 flex-1 flex-col gap-[3px] text-sm text-gray-600">
                <span>Detail #{index + 1}</span>
                <input
                  value={details[index] ?? ""}
                  placeholder={detailPlaceholder}
                  onChange={(event) => onDetailChange(index, event.target.value)}
                  className="h-9 min-w-0 rounded-[100px] border border-rose-600 bg-neutral-50 px-3 text-sm outline-none placeholder:text-slate-900/40"
                />
              </label>
            )}
            <IconButton
              label={`Delete list ${index + 1}`}
              variant="danger"
              icon={<Trash2 size={17} />}
              onClick={() => onRemove(index)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
