"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@mis/ui/badge";
import { Button } from "@mis/ui/button";
import { Dropdown } from "@mis/ui/dropdown";
import { EmptyState } from "@mis/ui/empty-state";
import { IconButton } from "@mis/ui/icon-button";
import { LordIcon } from "@mis/ui/lord-icon";
import type { AccountValue } from "./account-dialog";

export type AccountStudent = { subject: string; name: string; ongoingTrainings: string[] };

const avatarStyles = [
  "from-red-400 to-orange-600",
  "from-purple-400 to-fuchsia-600",
  "from-green-400 to-green-600",
  "from-indigo-400 to-indigo-700",
  "from-cyan-300 to-sky-500",
];

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";

export function AccountDetailsDialog({
  account,
  pics,
  students,
  loadingStudents,
  canDelete,
  onClose,
  onEdit,
  onDelete,
}: {
  account: AccountValue & { account_type: string; industry_code: string };
  pics: { subject: string; name: string; email: string | null; status?: "PENDING" | "ACTIVE" | "INACTIVE" }[];
  students: AccountStudent[];
  loadingStudents: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState("ALL");
  const [viewAllStudents, setViewAllStudents] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  const courses = useMemo(
    () => [...new Set(students.flatMap((student) => student.ongoingTrainings))].sort((a, b) => a.localeCompare(b)),
    [students],
  );
  const visibleStudents = selectedCourse === "ALL"
    ? students
    : students.filter((student) => student.ongoingTrainings.includes(selectedCourse));
  const displayedStudents = viewAllStudents ? visibleStudents : visibleStudents.slice(0, 5);

  return (
    <div
      className={`fixed inset-0 z-[90] flex justify-end bg-zinc-950/30 backdrop-blur-[1px] ${
        isClosing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <aside
        aria-label="Account details"
        className={`flex h-full w-full max-w-[420px] flex-col items-start justify-between overflow-hidden bg-white p-6 outline outline-1 outline-offset-[-1px] outline-gray-200 shadow-2xl ${
          isClosing ? "animate-slide-out-right" : "animate-slide-in-right"
        }`}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col gap-6 self-stretch overflow-y-auto pr-1">
          <header className="flex shrink-0 items-start gap-3">
            <IconButton label="Close details" size="sm" icon="cross" onClick={handleClose} />
            <h2 className="pt-0.5 text-2xl font-medium text-gray-600">Account Details</h2>
          </header>

          <section className="flex shrink-0 flex-col gap-3">
            <h3 className="text-base font-normal text-zinc-950/60">Account Name</h3>
            <div className="flex items-center gap-3 overflow-hidden rounded-xl bg-[#FFFAFB] p-3 outline outline-1 outline-offset-[-1px] outline-[#FFE7EB]">
              <LordIcon
                src="building"
                size={20}
                colors="primary:#de1641,secondary:#de1641"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-gray-600">{account.name}</p>
                <p className="truncate text-sm text-zinc-600">{account.industry_name}</p>
              </div>
              <Badge variant={account.status === "ACTIVE" ? "success" : "danger"} showDot>
                {account.status === "ACTIVE" ? "Active" : "Inactive"}
              </Badge>
            </div>
          </section>

          <section className="flex shrink-0 flex-col gap-3">
            <h3 className="text-base font-normal text-zinc-950/60">PIC Name</h3>
            {pics.length ? (
              pics.map((pic) => (
                <button
                  type="button"
                  key={pic.subject}
                  onClick={() => {
                    router.push(
                      `/sales/person-in-charge?openPic=${encodeURIComponent(pic.email || pic.name)}`
                    );
                  }}
                  className="group flex w-full items-center gap-4 overflow-hidden rounded-xl bg-[#FFFAFB] p-3 text-left outline outline-1 outline-offset-[-1px] outline-[#FFE7EB] transition-colors hover:bg-rose-50/50 cursor-pointer"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <LordIcon
                      src="avatar-circle"
                      size={20}
                      colors="primary:#de1641,secondary:#de1641"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-gray-600 group-hover:text-rose-600 transition-colors">
                        {pic.name}
                      </p>
                      <p className="truncate text-sm font-medium text-zinc-600">{pic.email ?? ""}</p>
                    </div>
                  </div>
                  {pic.status && (
                    <Badge
                      variant={
                        pic.status === "ACTIVE" ? "success" : pic.status === "PENDING" ? "warning" : "danger"
                      }
                      showDot
                    >
                      {pic.status[0] + pic.status.slice(1).toLowerCase()}
                    </Badge>
                  )}
                  <LordIcon
                    src="chevron-right"
                    size={20}
                    colors="primary:#52525b,secondary:#71717a"
                    className="shrink-0 transition-colors group-hover:[--lord-icon-primary:#de1641] group-hover:[--lord-icon-secondary:#de1641]"
                  />
                </button>
              ))
            ) : (
              <div className="flex w-full items-center gap-3 overflow-hidden rounded-xl bg-[#FFFAFB] p-3 outline outline-1 outline-offset-[-1px] outline-[#FFE7EB]">
                <LordIcon
                  src="avatar-circle"
                  size={20}
                  colors="primary:#de1641,secondary:#de1641"
                  className="shrink-0"
                />
                <p className="flex-1 text-sm font-normal text-zinc-950/60">No PIC assigned.</p>
              </div>
            )}
          </section>

          <section className="flex min-h-0 flex-col gap-3">
            <h3 className="text-base font-normal text-zinc-950/60">Available Student</h3>
            <Dropdown
              label="Course"
              value={selectedCourse}
              onChange={(val) => setSelectedCourse(val)}
              options={[
                { label: "Showing All Course", value: "ALL" },
                ...courses.map((course) => ({ label: course, value: course })),
              ]}
            />
            {loadingStudents ? (
              <p className="py-3 text-center text-sm text-zinc-500">Loading students...</p>
            ) : visibleStudents.length ? (
              <div className="flex min-h-0 flex-col divide-y divide-rose-50">
                {displayedStudents.map((student, index) => (
                  <div key={student.subject} className="flex items-center gap-3 py-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b ${
                        avatarStyles[index % avatarStyles.length]
                      } text-base font-medium text-white`}
                    >
                      {initials(student.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-600">{student.name}</p>
                      <p className="truncate text-sm text-zinc-600">
                        {selectedCourse === "ALL"
                          ? student.ongoingTrainings.join(", ") || "No ongoing class"
                          : selectedCourse}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState size="sm" description="No students found for this course." />
            )}
            <p className="text-center text-sm text-zinc-600">Available {visibleStudents.length} Student..</p>
            {visibleStudents.length > 5 && (
              <Button
                variant="ghost"
                onClick={() => setViewAllStudents((current) => !current)}
                className="w-full text-rose-600"
                rightIcon={viewAllStudents ? "chevron-up" : "chevron-down"}
              >
                {viewAllStudents ? "Show Less" : "View All Student"}
              </Button>
            )}
          </section>
        </div>

        <footer className="mt-6 flex w-full shrink-0 gap-6 self-stretch pt-1">
          <Button
            variant="danger"
            leftIcon="trash"
            onClick={onDelete}
            disabled={!canDelete}
            className="min-w-0 flex-1 whitespace-nowrap"
          >
            Delete Account
          </Button>
          <Button
            leftIcon="pencil-line"
            onClick={onEdit}
            className="min-w-0 flex-1 whitespace-nowrap"
          >
            Edit Account
          </Button>
        </footer>
      </aside>
    </div>
  );
}
