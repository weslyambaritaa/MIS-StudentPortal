"use client";

import { useState } from "react";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";
import { LordIcon } from "@mis/ui/lord-icon";

export type QuotationStatus =
  | "WAITING"
  | "SEND_FAILED"
  | "APPROVED"
  | "CANCELLED"
  | "REVISION"
  | "DRAFT"
  | "SENT"
  | "REJECTED"
  | "EXPIRED";

export type QuotationListItem = {
  id: string;
  quotation_code: string;
  class_type: string;
  status: QuotationStatus;
  account_name: string;
  pic_name: string;
  course_count: number;
  students: number;
  amount: number;
  sent_at?: string | null;
};

export type QuotationDetail = {
  item: QuotationListItem & {
    account_id: string;
    pic_profile_id: string;
    pic_email: string;
  };
  lines: Array<{
    course_id: string;
    course_name: string;
    duration_minutes: number;
    amount_student: number;
    price: string;
    location: string;
  }>;
  documents?: Array<{ version: number; recipient_email: string; sent_at: string }>;
};

type Props = {
  quotation: QuotationDetail | null;
  busy: boolean;
  onClose: () => void;
  onDelete: (quotation: QuotationListItem) => void;
  onEdit: (quotation: QuotationListItem) => void;
  onResend: (quotation: QuotationListItem) => void;
  onOpenDocument: (quotationId: string, version: number) => void;
};

const statusLabel = (value: QuotationStatus) =>
  ({
    WAITING: "Waiting",
    SEND_FAILED: "Send failed",
    APPROVED: "Approved",
    CANCELLED: "Cancelled",
    REVISION: "Revision",
    DRAFT: "Draft",
    SENT: "Waiting",
    REJECTED: "Cancelled",
    EXPIRED: "Cancelled",
  })[value];

const statusVariant = (value: QuotationStatus): "success" | "danger" | "warning" | "neutral" => {
  if (value === "APPROVED") return "success";
  if (value === "WAITING" || value === "SENT") return "warning";
  if (value === "SEND_FAILED" || value === "CANCELLED" || value === "REJECTED" || value === "EXPIRED") return "danger";
  return "neutral";
};

const money = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;

export function QuotationDetailsDialog({
  quotation,
  busy,
  onClose,
  onDelete,
  onEdit,
  onResend,
  onOpenDocument,
}: Props) {
  const [isClosing, setIsClosing] = useState(false);

  if (!quotation) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  const isPublic =
    quotation.item.class_type === "PUBLIC" || quotation.item.class_type === "ONLINE_PUBLIC";
  const amount = quotation.lines.reduce(
    (total, line) =>
      total + Number(line.price) * (isPublic ? 1 : Number(line.amount_student)),
    0,
  );
  const latestDocument = quotation.documents?.length
    ? [...quotation.documents].sort((a, b) => b.version - a.version)[0]
    : undefined;

  return (
    <div
      className={`fixed inset-0 z-40 flex justify-end bg-zinc-950/30 backdrop-blur-[1px] ${
        isClosing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <aside
        aria-label="Quotation details"
        className={`relative z-10 flex h-full w-full max-w-[420px] flex-col justify-between overflow-hidden border-l border-gray-200 bg-white p-6 shadow-xl ${
          isClosing ? "animate-slide-out-right" : "animate-slide-in-right"
        }`}
      >
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
          <header className="flex shrink-0 items-start gap-3">
            <IconButton label="Close details" size="sm" icon="cross" onClick={handleClose} />
            <h2 className="pt-0.5 text-2xl font-medium text-gray-600">Quotation Details</h2>
          </header>

          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-normal text-zinc-950/60">Quotation Details</h3>
              <div className="flex flex-col gap-4 rounded-xl border border-rose-50 bg-[#FFFAFB] p-3 outline outline-1 outline-offset-[-1px] outline-[#FFE7EB]">
                <div className="flex items-center gap-3">
                  <LordIcon
                    src="file-text"
                    size={22}
                    colors="primary:#de1641,secondary:#de1641"
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-medium text-gray-600">
                      {quotation.item.quotation_code}
                    </div>
                    <div className="truncate text-sm font-medium text-zinc-950/60">
                      {quotation.item.account_name}
                    </div>
                  </div>
                  <Badge variant={statusVariant(quotation.item.status)} showDot>
                    {statusLabel(quotation.item.status)}
                  </Badge>
                </div>
                <div className="h-px w-full bg-zinc-950/20" />
                <div className="flex items-center gap-2">
                  <LordIcon
                    src="hand-dollar"
                    size={20}
                    colors="primary:#de1641,secondary:#de1641"
                    className="shrink-0"
                  />
                  <div className="text-base font-medium text-gray-600">
                    Amount: <span className="text-rose-600">{money(amount)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-normal text-zinc-950/60">PIC Name</h3>
              <div className="flex items-center gap-4 overflow-hidden rounded-xl border border-rose-50 bg-[#FFFAFB] p-3 outline outline-1 outline-offset-[-1px] outline-[#FFE7EB]">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <LordIcon
                    src="avatar-circle"
                    size={20}
                    colors="primary:#de1641,secondary:#de1641"
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-medium text-gray-600">
                      {quotation.item.pic_name}
                    </div>
                    <div className="truncate text-sm font-medium text-zinc-950/60">
                      {quotation.item.pic_email}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-normal text-zinc-950/60">Requested Course</h3>
              <div className="flex flex-col gap-3">
                {quotation.lines.map((line) => (
                  <div
                    key={line.course_id}
                    className="flex items-center gap-3 rounded-xl border border-rose-50 bg-[#FFFAFB] p-3 outline outline-1 outline-offset-[-1px] outline-[#FFE7EB]"
                  >
                    <LordIcon
                      src="book"
                      size={20}
                      colors="primary:#de1641,secondary:#de1641"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-600">{line.course_name}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600">
                        {isPublic
                          ? `${Math.max(1, Math.ceil(line.duration_minutes / 480))} Day(s)`
                          : `${line.amount_student} Students`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-normal text-zinc-950/60">Template Email</h3>
              <div className="flex flex-col gap-2 rounded-3xl border border-blue-500 bg-blue-500/20 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
                  <LordIcon
                    src="info"
                    size={18}
                    colors="primary:#2563eb,secondary:#3b82f6"
                    className="shrink-0"
                  />
                  Quotation Email Template
                </div>
                <p className="text-sm text-slate-900/60">
                  The email template is the one that will be sent to the client for a quotation.
                </p>
                <button
                  type="button"
                  disabled={!latestDocument}
                  className="flex items-center gap-1 self-start text-sm font-medium text-blue-600 hover:text-blue-800 underline disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                  onClick={() => latestDocument && onOpenDocument(quotation.item.id, latestDocument.version)}
                >
                  View Email Template ↗
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-4 flex shrink-0 flex-col gap-3 pt-2">
          {quotation.item.status === "SEND_FAILED" && (
            <Button variant="soft" disabled={busy} onClick={() => onResend(quotation.item)}>
              Resend Quotation
            </Button>
          )}
          <div className="flex gap-3">
            <Button
              variant="danger"
              leftIcon="trash"
              className="min-w-0 flex-1 whitespace-nowrap"
              onClick={() => onDelete(quotation.item)}
            >
              Delete Quotation
            </Button>
            <Button
              leftIcon="pencil-line"
              className="min-w-0 flex-1 whitespace-nowrap"
              onClick={() => onEdit(quotation.item)}
            >
              Edit Quotation
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
