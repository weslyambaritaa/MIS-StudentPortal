"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

type MultipleListProps = {
  title: string;
  values: string[];
  placeholder?: string;

  onChange: (index: number, value: string) => void;

  onAdd: () => void;

  onRemove: (index: number) => void;
};

export function MultipleList({
  title,
  values,
  placeholder = "Placeholder",
  onChange,
  onAdd,
  onRemove,
}: MultipleListProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h3 className="font-medium text-[var(--color-primary)]">{title}</h3>

        <Button size="sm" leftIcon={<Plus size={16} />} onClick={onAdd}>
          Add List
        </Button>
      </div>

      <div className="space-y-4">
        {values.map((value, index) => (
          <div key={index} className="space-y-1">
            <label className="text-sm">List #{index + 1}</label>

            <div className="flex items-center gap-3">
              <input
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(index, event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-full border border-[var(--color-primary)] px-4 text-sm outline-none"
              />

              <IconButton
                label={`Delete list ${index + 1}`}
                variant="soft"
                icon={<Trash2 size={17} />}
                onClick={() => onRemove(index)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
