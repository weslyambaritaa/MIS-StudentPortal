"use client";

import { useState } from "react";
import { Home, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { MultipleList } from "@/components/ui/multiple-list";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";

export default function ComponentsPreviewPage() {
  const [page, setPage] = useState(1);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [items, setItems] = useState([""]);

  return (
    <main className="min-h-screen space-y-10 bg-white p-10">
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

        <Input label="Label" placeholder="Placeholder" leftIcon={<Search size={17} />} />

        <Input label="Label" placeholder="Placeholder" />

        <Textarea label="Label" placeholder="Placeholder" />
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
    </main>
  );
}
