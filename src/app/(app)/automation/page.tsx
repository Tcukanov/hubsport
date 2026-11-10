"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/components/data";
import { useState } from "react";
import { Button, Card, Empty, PageHeader, Stat, Toggle } from "@/components/ui";
import { fmtDateTime, relTime } from "@/lib/format";
import { displayName } from "@/lib/objects";
import { describeTrigger } from "@/lib/workflow-config";

export default function AutomationPage() {
  const { db, create, update, remove } = useData();
  const router = useRouter();
  const [nowMs] = useState(() => Date.now());
  const weekAgo = new Date(nowMs - 7 * 864e5).toISOString();
  const runsThisWeek = db.workflowRuns.filter((r) => r.createdAt >= weekAgo).length;

  return (
    <div>
      <PageHeader title="Automation" subtitle="Workflows that react to what happens in the CRM.">
        <Button
          variant="primary"
          onClick={() => {
            const w = create("workflows", { name: "Untitled workflow", enabled: false, trigger: { type: "contact_created", value: "" }, actions: [] });
            router.push(`/automation/${w.id}`);
          }}
        >
          <Plus size={16} />
          Create workflow
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Workflows" value={db.workflows.length} />
        <Stat label="Turned on" value={db.workflows.filter((w) => w.enabled).length} />
        <Stat label="Runs, last 7 days" value={runsThisWeek} />
        <Stat label="Runs, all time" value={db.workflowRuns.length} hint="Last 300 are kept" />
      </div>

      <Card className="mt-5 overflow-x-auto" title="Workflows">
        {db.workflows.length === 0 ? (
          <Empty title="No workflows yet" hint="Create one to follow up on form submissions or hand over won deals automatically." />
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">On</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Starts when</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
                <th className="px-4 py-2.5 font-medium">Runs</th>
                <th className="px-4 py-2.5 font-medium">Last run</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {db.workflows.map((w) => {
                const runs = db.workflowRuns.filter((r) => r.workflowId === w.id);
                return (
                  <tr key={w.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      <Toggle on={w.enabled} label={`Turn ${w.name} ${w.enabled ? "off" : "on"}`} onChange={(v) => update("workflows", w.id, { enabled: v })} />
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/automation/${w.id}`} className="text-teal-700 hover:underline">
                        {w.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-stone-700">{describeTrigger(w, db)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{w.actions.length}</td>
                    <td className="px-4 py-2.5 tabular-nums">{runs.length}</td>
                    <td className="px-4 py-2.5 text-stone-600">{runs[0] ? relTime(runs[0].createdAt) : "—"}</td>
                    <td className="px-4 py-2.5">
                      <button type="button" aria-label={`Delete ${w.name}`} onClick={() => window.confirm(`Delete the workflow "${w.name}"?`) && remove("workflows", w.id)} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-600">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-5" title="Recent runs">
        {db.workflowRuns.length === 0 ? (
          <Empty title="Nothing has run yet" hint="Submit a published form or move a deal to Closed won to see a workflow fire." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {db.workflowRuns.slice(0, 15).map((r) => {
              const w = db.workflows.find((x) => x.id === r.workflowId);
              const contact = db.contacts.find((c) => c.id === r.contactId);
              const deal = db.deals.find((d) => d.id === r.dealId);
              return (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="font-medium text-stone-900">{w?.name ?? "Deleted workflow"}</span>
                  {contact && (
                    <Link href={`/contacts/${contact.id}`} className="text-teal-700 hover:underline">
                      {displayName("contacts", contact)}
                    </Link>
                  )}
                  {deal && (
                    <Link href={`/deals/${deal.id}`} className="text-teal-700 hover:underline">
                      {deal.name}
                    </Link>
                  )}
                  <span className="text-stone-600">{r.summary}</span>
                  <span className="ml-auto text-xs text-stone-400" title={fmtDateTime(r.createdAt)}>
                    {relTime(r.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
