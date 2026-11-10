"use client";

import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/components/data";
import { PropValue } from "@/components/props";
import { Button, Card, Empty, inputCls } from "@/components/ui";
import { OBJECTS, displayName } from "@/lib/objects";
import { SEGMENT_OPS, segmentContacts } from "@/lib/segments";
import type { SegmentFilter } from "@/lib/types";

const FIELDS = OBJECTS.contacts.props;
const COLUMNS = ["email", "lifecycleStage", "leadStatus", "createdAt"].map((k) => FIELDS.find((p) => p.key === k)!);

export default function SegmentPage() {
  const { id } = useParams<{ id: string }>();
  const { db, update } = useData();
  const segment = db.segments.find((s) => s.id === id);

  if (!segment)
    return (
      <Empty title="Segment not found">
        <Link href="/segments" className="text-sm text-teal-700 hover:underline">
          Back to segments
        </Link>
      </Empty>
    );

  const matches = segmentContacts(segment, db.contacts);
  const setFilters = (filters: SegmentFilter[]) => update("segments", id, { filters });
  const patchFilter = (i: number, patch: Partial<SegmentFilter>) => setFilters(segment.filters.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  return (
    <div>
      <Link href="/segments" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft size={15} />
        Segments
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          aria-label="Segment name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight text-stone-900 outline-none hover:border-stone-300 focus:border-teal-500 focus:bg-white"
          value={segment.name}
          onChange={(e) => update("segments", id, { name: e.target.value })}
        />
        <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-800">
          {matches.length} contact{matches.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card title="Filters">
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm text-stone-700">
              Contacts must match
              <select aria-label="Match mode" className={`${inputCls} !w-auto`} value={segment.match} onChange={(e) => update("segments", id, { match: e.target.value })}>
                <option value="all">all filters</option>
                <option value="any">any filter</option>
              </select>
            </div>
            {segment.filters.map((f, i) => {
              const def = FIELDS.find((p) => p.key === f.field);
              const op = SEGMENT_OPS.find((o) => o.value === f.op);
              const choices = def?.type === "select" ? def.options : def?.type === "bool" ? [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] : def?.type === "user" ? db.users.map((u) => ({ value: u.id, label: u.name })) : def?.type === "company" ? db.companies.map((c) => ({ value: c.id, label: c.name })) : null;
              const pickable = choices && (f.op === "is" || f.op === "is_not");
              return (
                <div key={i} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-stone-500">
                    {i === 0 ? "Where" : segment.match === "all" ? "And" : "Or"}
                    <button type="button" aria-label="Remove filter" onClick={() => setFilters(segment.filters.filter((_, k) => k !== i))} className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-rose-600">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid gap-2">
                    <select aria-label="Property" className={inputCls} value={f.field} onChange={(e) => patchFilter(i, { field: e.target.value, value: "" })}>
                      {FIELDS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <select aria-label="Condition" className={inputCls} value={f.op} onChange={(e) => patchFilter(i, { op: e.target.value })}>
                      {SEGMENT_OPS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {!op?.noValue &&
                      (pickable ? (
                        <select aria-label="Value" className={inputCls} value={f.value} onChange={(e) => patchFilter(i, { value: e.target.value })}>
                          <option value="">Choose…</option>
                          {choices!.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          aria-label="Value"
                          className={inputCls}
                          type={f.op === "before" || f.op === "after" ? "date" : f.op === "in_last_days" ? "number" : "text"}
                          placeholder="Value"
                          value={f.value}
                          onChange={(e) => patchFilter(i, { value: e.target.value })}
                        />
                      ))}
                  </div>
                </div>
              );
            })}
            <Button size="sm" onClick={() => setFilters([...segment.filters, { field: "lifecycleStage", op: "is", value: "" }])}>
              <Plus size={14} />
              Add filter
            </Button>
            <p className="text-xs text-stone-500">Changes save automatically. The list on the right updates as you edit.</p>
          </div>
        </Card>

        <Card title="Matching contacts" className="overflow-x-auto">
          {matches.length === 0 ? (
            <Empty title="No contacts match these filters" hint="Loosen a filter or switch to “any filter”." />
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="px-4 py-2.5 font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {matches.slice(0, 100).map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/contacts/${c.id}`} className="text-teal-700 hover:underline">
                        {displayName("contacts", c)}
                      </Link>
                    </td>
                    {COLUMNS.map((col) => (
                      <td key={col.key} className="whitespace-nowrap px-4 py-2.5 text-stone-700">
                        <PropValue def={col} rec={c} db={db} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
