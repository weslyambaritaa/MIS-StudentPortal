"use client";

import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";
import { Modal } from "@mis/ui/modal";

type WithdrawConfirmationProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function WithdrawConfirmation({
  open,
  onClose,
  onConfirm,
  loading = false,
}: WithdrawConfirmationProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-medium text-gray-600">
          Are you sure you want to withdraw?
        </h2>

        <IconButton label="Close" size="sm" icon="x" onClick={onClose} />
      </div>

      <div className="my-4 h-px bg-zinc-950/20" />

      <p className="text-sm text-zinc-950/60">
        This Request Form will return to Draft. You can edit it and submit it to Admin again.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} className="min-w-0 flex-1">
          No, Cancel
        </Button>

        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={loading}
          className="min-w-0 flex-1"
        >
          {loading ? "Withdrawing..." : "Yes, Withdraw"}
        </Button>
      </div>
    </Modal>
  );
}
