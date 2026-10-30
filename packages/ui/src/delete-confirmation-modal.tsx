"use client";

import { Button } from "./button";
import { IconButton } from "./icon-button";
import { Modal } from "./modal";

type DeleteConfirmationModalProps = {
  open: boolean;
  itemName: string;
  description?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function DeleteConfirmationModal({
  open,
  itemName,
  description,
  onClose,
  onConfirm,
  loading = false,
}: DeleteConfirmationModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-medium text-gray-600">
          Are you sure you want to delete?
        </h2>

        <IconButton label="Close" size="sm" icon="x" onClick={onClose} />
      </div>

      <div className="my-4 h-px bg-zinc-950/20" />

      <p className="text-sm text-zinc-950/60">
        {description ?? `The following content “${itemName}” will be deleted permanently, with its child...`}
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} className="min-w-0 flex-1">
          No, Cancel
        </Button>

        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={loading}
          rightIcon="trash"
          className="min-w-0 flex-1"
        >
          {loading ? "Deleting..." : "Yes, Delete"}
        </Button>
      </div>
    </Modal>
  );
}
