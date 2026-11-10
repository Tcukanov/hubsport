"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/components/data";
import { Button, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { segmentContacts } from "@/lib/segments";

export default function SegmentsPage() {
  const { db, create, remove } = useData();
  const router = useRouter();

  return (
    <div>
      <PageHeader title="Segments" subtitle="Lists of contacts that update automatically as records change.">
        <Button
          variant="primary"
          onClick={() => {
            const s = create("segments", { name: "Untitled segment", match: "all", filters: [{ field: "lifecycleStage", op: "is", value: "lead" }] });
            router.push(`/segments/${s.id}`);
          }}
        >
          <Plus size={16} />
          Create segment
        </Button>
      </PageHeader>
      <Card className="overflow-x-auto">
        {db.segments.length === 0 ? (
          <Empty title="No segments yet" hint="Create a segment to group contacts by any property." />
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Contacts</th>
                <th className="px-4 py-2.5 font-medium">Filters</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {db.segments.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/segments/${s.id}`} className="text-violet-700 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{segmentContacts(s, db.contacts).length}</td>
                  <td className="px-4 py-2.5 text-stone-600">
                    {s.filters.length} · match {s.match}
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">{fmtDate(s.updatedAt)}</td>
                  <td className="px-4 py-2.5">
                    <button type="button" aria-label={`Delete ${s.name}`} onClick={() => window.confirm(`Delete the segment "${s.name}"?`) && remove("segments", s.id)} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-600">
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
