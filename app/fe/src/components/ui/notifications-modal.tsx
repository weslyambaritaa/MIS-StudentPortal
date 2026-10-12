"use client";

import { Bell, ChevronRight, CircleAlert, Info, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  tone?: "danger" | "info";
};

type NotificationsModalProps = {
  open: boolean;
  onClose: () => void;
  notifications: readonly NotificationItem[];
  onSelect?: (notification: NotificationItem) => void;
};

export function NotificationsModal({
  open,
  onClose,
  notifications,
  onSelect,
}: NotificationsModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-1 items-center gap-2">
              <Bell aria-hidden="true" className="size-5 text-gray-600" />
              <h2 className="font-['DM_Sans'] text-base font-medium text-slate-900">
                My Notification
              </h2>
            </div>
            <IconButton
              label="Close notifications"
              size="sm"
              icon={<X size={20} strokeWidth={1.7} />}
              onClick={onClose}
            />
          </div>
          <div className="h-px w-full bg-zinc-950/20" />
        </div>

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="rounded-2xl border border-rose-50 bg-neutral-50 px-3 py-6 text-center text-sm text-zinc-950/60">
              You don&apos;t have any notifications.
            </p>
          ) : (
            notifications.map((notification) => {
              const isDanger = notification.tone !== "info";
              const Icon = isDanger ? CircleAlert : Info;
              const toneClass = isDanger ? "text-red-500" : "text-sky-600";

              return (
                <button
                  key={notification.id}
                  type="button"
                  disabled={!onSelect}
                  onClick={() => onSelect?.(notification)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-rose-50 bg-neutral-50 px-3 py-2.5 text-left transition-colors enabled:hover:bg-rose-50 disabled:cursor-default"
                >
                  <span className="flex min-w-0 flex-1 items-start gap-3">
                    <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${toneClass}`} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`font-['DM_Sans'] text-sm font-medium ${toneClass}`}>
                        {notification.title}
                      </span>
                      <span className="font-['DM_Sans'] text-xs text-slate-900/60">
                        {notification.message}
                      </span>
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-zinc-950/60" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
