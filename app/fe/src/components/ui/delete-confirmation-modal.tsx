"use client";

import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";

type DeleteConfirmationModalProps = {
  open: boolean;
  itemName: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function DeleteConfirmationModal({
  open,
  itemName,
  onClose,
  onConfirm,
  loading = false,
}: DeleteConfirmationModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-medium text-[var(--color-text-primary)]">
          Are you sure you want to delete?
        </h2>

        <IconButton label="Close" size="sm" icon={<X size={20} />} onClick={onClose} />
      </div>

      <div className="my-4 h-px bg-[var(--color-border)]" />

      <p className="text-sm text-[var(--color-text-secondary)]">
        The following content &quot;{itemName}&quot; will be deleted permanently, with its child...
      </p>

      <div className="mt-6 flex items-center justify-between gap-4">
        <Button onClick={onClose} className="min-w-[180px]">
          No, Cancel
        </Button>

        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={loading}
          rightIcon={<Trash2 size={17} />}
        >
          {loading ? "Deleting..." : "Yes, Delete"}
        </Button>
      </div>
    </Modal>
  );
}
