"use client";

import { LogOut, X } from "lucide-react";

import { Button } from "./button";
import { IconButton } from "./icon-button";
import { Modal } from "./modal";

type LogoutConfirmationModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmationModal({
  open,
  onClose,
  onConfirm,
}: LogoutConfirmationModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-sans text-2xl font-medium text-gray-600">
              Are you sure you want to logout?
            </h2>
            <IconButton
              label="Close logout confirmation"
              size="sm"
              icon="cross"
              onClick={onClose}
            />
          </div>
          <div className="h-px w-full bg-zinc-950/20" />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={onClose} className="min-w-0 flex-1">
            No, Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={onConfirm}
            rightIcon={<LogOut size={18} strokeWidth={1.7} />}
            className="min-w-0 flex-1"
          >
            Yes, Logout
          </Button>
        </div>
      </div>
    </Modal>
  );
}
