"use client";

import { Columns3, Plus, Table2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/data";
import { CreateRecordDrawer, ObjectList } from "@/components/object-list";
import { Avatar, Badge, Button, PageHeader, cx, inputCls } from "@/components/ui";
import { DEAL_STAGES, OPEN_STAGES, PRIORITIES } from "@/lib/config";
import { fmtDate, money } from "@/lib/format";

function Board() {
  const { db, update } = useData();
  const [owner, setOwner] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const deals = db.deals.filter((d) => !owner || d.ownerId === owner);

  return (
    <div>
      <div className="mb-3">
        <select aria-label="Filter by owner" className={`${inputCls} !w-auto`} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Owner: all</option>
          {db.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {DEAL_STAGES.map((stage) => {
          const list = deals.filter((d) => d.stage === stage.value);
          const total = list.reduce((sum, d) => sum + d.amount, 0);
          return (
            <div
              key={stage.value}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage.value);
              }}
              onDragLeave={() => setOver((o) => (o === stage.value ? null : o))}
              onDrop={() => {
                if (dragId) update("deals", dragId, { stage: stage.value });
                setDragId(null);
                setOver(null);
              }}
              className={cx("flex w-64 shrink-0 flex-col rounded-xl border bg-stone-100/70", over === stage.value ? "border-violet-400 bg-violet-50" : "border-stone-200")}
            >
              <div className="flex items-center justify-between px-3 pt-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-600">{stage.label}</h2>
                <span className="text-xs text-stone-500">{list.length}</span>
              </div>
              <div className="min-h-24 flex-1 space-y-2 p-2">
                {list.map((d) => {
                  const company = db.companies.find((c) => c.id === d.companyId);
                  const user = db.users.find((u) => u.id === d.ownerId);
                  const priority = PRIORITIES.find((p) => p.value === d.priority);
                  return (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      className={cx("cursor-grab rounded-lg border border-stone-200 bg-white p-3 shadow-sm active:cursor-grabbing", dragId === d.id && "opacity-50")}
                    >
                      <Link href={`/deals/${d.id}`} className="block text-sm font-medium text-violet-700 hover:underline">
                        {d.name}
                      </Link>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-stone-900">{money(d.amount)}</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        Close {fmtDate(d.closeDate)}
                        {company ? ` · ${company.name}` : ""}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        {priority && <Badge tone={priority.tone}>{priority.label}</Badge>}
                        {user && <Avatar name={user.name} color={user.color} size={22} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-stone-200 px-3 py-2 text-xs text-stone-600">
                Total <span className="font-semibold tabular-nums text-stone-900">{money(total)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DealsPage() {
  const { db } = useData();
  const [view, setView] = useState<"board" | "table">("board");
  const [creating, setCreating] = useState(false);
  const open = db.deals.filter((d) => OPEN_STAGES.includes(d.stage));

  return (
    <div>
      <PageHeader title="Deals" subtitle={`${open.length} open deals worth ${money(open.reduce((s, d) => s + d.amount, 0))}`}>
        <div className="flex rounded-md border border-stone-300 bg-white p-0.5">
          {(["board", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cx("inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium capitalize", view === v ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100")}
            >
              {v === "board" ? <Columns3 size={15} /> : <Table2 size={15} />}
              {v}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          Create deal
        </Button>
      </PageHeader>
      {view === "board" ? <Board /> : <ObjectList kind="deals" hideHeader />}
      <CreateRecordDrawer kind="deals" open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
