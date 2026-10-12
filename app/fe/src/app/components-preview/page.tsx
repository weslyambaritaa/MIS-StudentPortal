"use client";

import { useState } from "react";
import { ChevronDown, Home, Plus, Search } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DropBox } from "@/components/ui/drop-box";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { MultipleList } from "@/components/ui/multiple-list";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import { NotificationsModal, type NotificationItem } from "@/components/ui/notifications-modal";
import { RadioGroup } from "@/components/ui/radio-group";
import {
  CheckRoomAvailabilityModal,
  type CheckRoomAvailabilityStatus,
  type RoomOption,
} from "@/ui/admin/rooms/dialog/check-room-availability-modal";

export default function ComponentsPreviewPage() {
  const [page, setPage] = useState(1);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<string | null>(null);
  const [selectedTraining, setSelectedTraining] = useState<string | null>(null);
  const [roomAvailabilityOpen, setRoomAvailabilityOpen] = useState(false);
  const [roomAvailabilityStatus, setRoomAvailabilityStatus] =
    useState<CheckRoomAvailabilityStatus>("idle");
  const [roomDate, setRoomDate] = useState("2026-08-28");
  const [selectedRoomId, setSelectedRoomId] = useState("bright");

  const previewRooms: RoomOption[] = [
    { id: "bright", name: "Bright", capacity: 20 },
    { id: "summit", name: "Summit", capacity: 30 },
  ];

  const [items, setItems] = useState([""]);

  const [upload, setUpload] = useState<File | null>(null);

  const [course, setCourse] = useState("course-2");

  const notifications: NotificationItem[] = [
    {
      id: "check-in-reminder",
      title: "You have not check-in",
      message: "You have not check-in on Power BI Fundamental training. Check-in now.",
      tone: "danger",
    },
    {
      id: "schedule-update",
      title: "Training schedule updated",
      message: "The schedule for Power BI Fundamental has been updated.",
      tone: "info",
    },
    {
      id: "evaluation-reminder",
      title: "Evaluation is available",
      message: "Complete your training evaluation after the final session.",
      tone: "info",
    },
  ];

  type TrainingExample = {
    id: string;
    course: string;
    account: string;
    classType: string;
    dateSession: string;
    room: string;
    status: "Active" | "Pending";
  };

  const tableColumns: DataTableColumn<TrainingExample>[] = [
    { key: "course", header: "COURSE", render: (row) => row.course },
    { key: "account", header: "ACCOUNT", render: (row) => row.account },
    { key: "classType", header: "CLASS TYPE", render: (row) => row.classType },
    { key: "dateSession", header: "DATE SESSION", render: (row) => row.dateSession },
    { key: "room", header: "ROOM OR PLACE", render: (row) => row.room },
    {
      key: "status",
      header: "STATUS",
      render: (row) => (
        <Badge variant={row.status === "Active" ? "success" : "warning"} showDot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "ACTION",
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setSelectedTraining(row.id)}>
          View
        </Button>
      ),
    },
  ];

  const tableRows: TrainingExample[] = [
    {
      id: "trn-2608-02",
      course: "Power BI Fundamental",
      account: "Bright",
      classType: "Public Training",
      dateSession: "28 Aug 2026, 09:00-16:00",
      room: "Bright Room",
      status: "Active",
    },
    {
      id: "trn-2609-01",
      course: "Data Storytelling",
      account: "Northwind",
      classType: "In-house",
      dateSession: "15 Sep 2026, 09:00-16:00",
      room: "Online",
      status: "Pending",
    },
  ];

  return (
    <AppShell title="Design System">
      <div className="space-y-10 rounded-3xl bg-white p-5 md:p-8">
      <header>
        <h1 className="text-3xl font-semibold text-zinc-950">Design System</h1>
        <p className="mt-2 text-sm text-zinc-950/60">
          Interactive preview of shared UI components, tokens, and common patterns.
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Color &amp; Typography</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Primary", "#de1641", "bg-[var(--color-primary)]"],
            ["Primary soft", "#fde8ee", "bg-[var(--color-primary-soft)]"],
            ["Success", "#16a34a", "bg-[var(--color-success)]"],
            ["Warning", "#f59e0b", "bg-[var(--color-warning)]"],
          ].map(([label, value, colorClass]) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-rose-50 p-3">
              <span className={`size-9 rounded-lg ${colorClass}`} />
              <span>
                <span className="block text-sm font-medium text-zinc-950">{label}</span>
                <span className="text-xs text-zinc-950/60">{value}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 font-['DM_Sans']">
          <p className="text-2xl font-medium">DM Sans - Heading / h4 - 24px / 500</p>
          <p className="text-base">DM Sans - Paragraph / regular - 16px / 400</p>
          <p className="text-sm font-medium">DM Sans - Small / medium - 14px / 500</p>
          <p className="text-xs">DM Sans - Extra Small / regular - 12px / 400</p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Button</h2>

        <div className="flex flex-wrap gap-4">
          <Button leftIcon={<Home size={16} />} rightIcon={<Home size={16} />}>
            Dashboard
          </Button>

          <Button variant="soft">Dashboard</Button>

          <Button variant="ghost">Dashboard</Button>

          <Button size="sm" leftIcon={<Plus size={14} />}>
            Add List
          </Button>
        </div>
      </section>

      <section className="max-w-sm space-y-4">
        <h2 className="text-xl font-semibold">Form</h2>

        <Box label="Label" placeholder="Placeholder" leftIcon={<Search size={17} />} rightIcon={<Search size={17} />} />

        <Box
          label="Label"
          placeholder="Placeholder"
          options={[{ label: "Option 1", value: "option-1" }]}
          rightIcon={<ChevronDown size={18} />}
        />

        <Box label="Label" placeholder="Placeholder" multiline />

        <Input label="Label" placeholder="Placeholder" leftIcon={<Search size={17} />} />

        <Input label="Label" placeholder="Placeholder" />

        <Textarea label="Label" placeholder="Placeholder" />
      </section>

      <section className="max-w-sm space-y-4">
        <h2 className="text-xl font-semibold">Drop Box</h2>
        <DropBox file={upload} onFileChange={setUpload} accept=".pdf,.png,.jpg,.jpeg" />
      </section>

      <section className="max-w-sm space-y-4">
        <h2 className="text-xl font-semibold">Radio</h2>
        <RadioGroup
          ariaLabel="Pick a course"
          name="course"
          value={course}
          onValueChange={setCourse}
          options={[
            { label: "Pick a Course", value: "course-1" },
            { label: "Pick a Course", value: "course-2" },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Badge</h2>

        <div className="flex gap-3">
          <Badge variant="success">Active</Badge>

          <Badge variant="warning">Pending</Badge>

          <Badge variant="danger">Inactive</Badge>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Multiple List</h2>

        <div className="max-w-md">
          <MultipleList
            title="Title List"
            values={items}
            onAdd={() => setItems((current) => [...current, ""])}
            onChange={(index, value) =>
              setItems((current) => current.map((item, i) => (i === index ? value : item)))
            }
            onRemove={(index) => setItems((current) => current.filter((_, i) => i !== index))}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Pagination</h2>

        <Pagination
          page={page}
          totalPages={3}
          pageSize={8}
          totalItems={150}
          onPageChange={setPage}
        />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Table</h2>
        <DataTable
          caption="Example training schedule"
          columns={tableColumns}
          rows={tableRows}
          getRowKey={(row) => row.id}
        />
        {selectedTraining && (
          <p role="status" className="mt-3 text-sm text-zinc-950/60">
            Selected training: {selectedTraining}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Delete Confirmation</h2>

        <Button onClick={() => setDeleteOpen(true)}>Open Delete Modal</Button>

        <DeleteConfirmationModal
          open={deleteOpen}
          itemName="content_name"
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => {
            console.log("Delete");
            setDeleteOpen(false);
          }}
        />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Notifications Modal</h2>
        <Button variant="soft" onClick={() => setNotificationsOpen(true)}>
          Open Notifications
        </Button>
        {selectedNotification && (
          <p role="status" className="mt-3 text-sm text-zinc-950/60">
            Selected notification: {selectedNotification}
          </p>
        )}
        <NotificationsModal
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          notifications={notifications}
          onSelect={(notification) => {
            setSelectedNotification(notification.title);
            setNotificationsOpen(false);
          }}
        />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Check Room Availability</h2>
        <div className="flex flex-wrap gap-3">
          {([
            ["idle", "Initial"],
            ["booked", "Booked"],
            ["available", "Available"],
          ] as const).map(([status, label]) => (
            <Button
              key={status}
              variant="soft"
              onClick={() => {
                setRoomAvailabilityStatus(status);
                setRoomAvailabilityOpen(true);
              }}
            >
              Preview {label} Modal
            </Button>
          ))}
        </div>

        <CheckRoomAvailabilityModal
          open={roomAvailabilityOpen}
          onClose={() => setRoomAvailabilityOpen(false)}
          rooms={previewRooms}
          selectedDate={roomDate}
          selectedRoomId={selectedRoomId}
          status={roomAvailabilityStatus}
          onDateChange={setRoomDate}
          onRoomChange={setSelectedRoomId}
          onSelectionChange={() => setRoomAvailabilityStatus("idle")}
          onCheckAvailability={() => undefined}
          onBookRoom={() => setRoomAvailabilityOpen(false)}
          conflict={{
            dateLabel: "28 Aug 2026",
            timeLabel: "09:00-16:00",
            trainingCode: "TRN-2608-02",
          }}
        />
      </section>
      </div>
    </AppShell>
  );
}
