"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/components/data";
import { Badge, Button, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export default function FormsPage() {
  const { db, create, remove } = useData();
  const router = useRouter();

  return (
    <div>
      <PageHeader title="Forms" subtitle="Collect leads. Every submission creates or updates a contact.">
        <Button
          variant="primary"
          onClick={() => {
            const f = create("forms", {
              name: "Untitled form",
              status: "draft",
              headline: "Get in touch",
              description: "",
              fields: [
                { key: "firstName", label: "First name", type: "text", required: false },
                { key: "email", label: "Email", type: "email", required: true },
              ],
              submitText: "Submit",
              thanksMessage: "Thanks for submitting the form.",
              lifecycleStage: "lead",
            });
            router.push(`/forms/${f.id}`);
          }}
        >
          <Plus size={16} />
          Create form
        </Button>
      </PageHeader>
      <Card className="overflow-x-auto">
        {db.forms.length === 0 ? (
          <Empty title="No forms yet" hint="Create a form and share its link to start collecting contacts." />
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Fields</th>
                <th className="px-4 py-2.5 font-medium">Submissions</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {db.forms.map((f) => (
                <tr key={f.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/forms/${f.id}`} className="text-teal-700 hover:underline">
                      {f.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={f.status === "published" ? "emerald" : "stone"}>{f.status === "published" ? "Published" : "Draft"}</Badge>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{f.fields.length}</td>
                  <td className="px-4 py-2.5 tabular-nums">{db.submissions.filter((s) => s.formId === f.id).length}</td>
                  <td className="px-4 py-2.5 text-stone-600">{fmtDate(f.updatedAt)}</td>
                  <td className="px-4 py-2.5">
                    <button type="button" aria-label={`Delete ${f.name}`} onClick={() => window.confirm(`Delete the form "${f.name}" and its submissions?`) && remove("forms", f.id)} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-600">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
