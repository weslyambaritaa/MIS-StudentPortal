"use client";

import { BookOpen, ExternalLink, FilePenLine, HandCoins, Info, Pencil, Trash2, UserRound, Users, X } from "lucide-react";
import { Button } from "@mis/ui/button";
import { IconButton } from "@mis/ui/icon-button";

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

const typeLabel = (value: string) =>
  ({ PRIVATE: "Private", PUBLIC: "Public", INHOUSE: "Inhouse", ONLINE: "Online" })[value] ?? value;

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

const statusStyle = (value: QuotationStatus) => {
  if (value === "WAITING" || value === "SENT") {
    return "bg-orange-600/20 text-orange-600 outline outline-1 outline-offset-[-1px] outline-orange-600";
  }
  if (value === "APPROVED") {
    return "bg-green-500/20 text-green-500 outline outline-1 outline-offset-[-1px] outline-green-500";
  }
  if (value === "REVISION") {
    return "bg-blue-500/20 text-blue-600 outline outline-1 outline-offset-[-1px] outline-blue-500";
  }
  if (value === "SEND_FAILED" || value === "CANCELLED" || value === "REJECTED" || value === "EXPIRED") {
    return "bg-red-500/20 text-red-500 outline outline-1 outline-offset-[-1px] outline-red-500";
  }
  return "bg-zinc-300/20 text-zinc-500 outline outline-1 outline-offset-[-1px] outline-zinc-400";
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
  if (!quotation) return null;

  const amount = quotation.lines.reduce(
    (total, line) => total + Number(line.price) * Number(line.amount_student),
    0,
  );
  const latestDocument = quotation.documents?.length
    ? [...quotation.documents].sort((a, b) => b.version - a.version)[0]
    : undefined;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button aria-label="Close details" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-96 flex-col justify-between overflow-hidden border-l border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
          <div className="flex shrink-0 items-start gap-3">
            <IconButton label="Close" size="sm" icon={<X size={18} />} onClick={onClose} />
            <h2 className="pt-0.5 text-2xl font-medium text-gray-600">Quotation Details</h2>
          </div>

          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-medium text-rose-600">Quotation Details</h3>
              <div className="flex flex-col gap-4 rounded-xl border border-rose-50 bg-neutral-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-radial-[at_50%_0%] from-red-400 to-orange-600 text-white">
                    <FilePenLine size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-medium text-gray-600">
                      {quotation.item.quotation_code}
                    </div>
                    <div className="truncate text-sm font-medium text-zinc-950/60">
                      {quotation.item.account_name}
                    </div>
                  </div>
                  <span className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusStyle(quotation.item.status)}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {statusLabel(quotation.item.status)}
                  </span>
                </div>
                <div className="h-px w-full bg-zinc-950/20" />
                <div className="flex items-start gap-2">
                  <HandCoins size={20} className="mt-0.5 shrink-0 text-zinc-950/60" />
                  <div className="text-base font-medium text-gray-600">
                    Amount: <span className="text-rose-600">{money(amount)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-medium text-rose-600">PIC Name</h3>
              <div className="flex items-center gap-4 overflow-hidden rounded-xl border border-rose-50 bg-neutral-50 p-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserRound size={20} className="shrink-0 text-rose-600" />
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
              <div className="flex items-start gap-2">
                <BookOpen size={20} className="text-rose-600" />
                <h3 className="text-base font-medium text-rose-600">Requested Course</h3>
              </div>
              <div className="flex flex-col gap-3">
                {quotation.lines.map((line) => (
                  <div
                    key={line.course_id}
                    className="flex items-center gap-3 rounded-xl border border-rose-50 bg-neutral-50 p-3"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-radial-[at_50%_0%] from-red-400 to-orange-600 text-white">
                      <BookOpen size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-600">{line.course_name}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600">
                        <Users size={14} className="text-gray-600" />
                        {line.amount_student} Students
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-medium text-rose-600">Template Email</h3>
              <div className="flex flex-col gap-2 rounded-3xl border border-blue-500 bg-blue-500/20 px-3 py-2.5">
                <div className="flex items-center gap-1 text-sm font-medium text-blue-500">
                  <Info size={20} />
                  Quotation Email Template
                </div>
                <p className="text-sm text-slate-900/40">
                  The email template is the one that will be sent to the client for a quotation.
                </p>
                <button
                  type="button"
                  disabled={!latestDocument}
                  className="flex items-center gap-1 self-start text-sm font-medium text-blue-500 underline disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => latestDocument && onOpenDocument(quotation.item.id, latestDocument.version)}
                >
                  View Email Template <ExternalLink size={16} />
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
            leftIcon={<Trash2 size={18} />}
            className="min-w-0 flex-1 whitespace-nowrap"
            onClick={() => onDelete(quotation.item)}
          >
            Delete Quotation
          </Button>
          <Button
            leftIcon={<Pencil size={18} />}
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
