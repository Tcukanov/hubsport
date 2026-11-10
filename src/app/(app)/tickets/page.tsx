"use client";

import { Columns3, Plus, Table2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/data";
import { CreateRecordDrawer, ObjectList } from "@/components/object-list";
import { Avatar, Badge, Button, PageHeader, cx, inputCls } from "@/components/ui";
import { PRIORITIES, TICKET_STATUS } from "@/lib/config";
import { relTime } from "@/lib/format";
import { displayName } from "@/lib/objects";

function Board() {
  const { db, update } = useData();
  const [owner, setOwner] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const tickets = db.tickets.filter((t) => !owner || t.ownerId === owner);

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
        {TICKET_STATUS.map((status) => {
          const list = tickets.filter((t) => t.status === status.value);
          return (
            <div
              key={status.value}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(status.value);
              }}
              onDragLeave={() => setOver((o) => (o === status.value ? null : o))}
              onDrop={() => {
                if (dragId) update("tickets", dragId, { status: status.value });
                setDragId(null);
                setOver(null);
              }}
              className={cx("flex w-72 shrink-0 flex-col rounded-xl border bg-stone-100/70", over === status.value ? "border-teal-400 bg-teal-50" : "border-stone-200")}
            >
              <div className="flex items-center justify-between px-3 pt-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-600">{status.label}</h2>
                <span className="text-xs text-stone-500">{list.length}</span>
              </div>
              <div className="min-h-24 flex-1 space-y-2 p-2">
                {list.map((t) => {
                  const contact = db.contacts.find((c) => c.id === t.contactId);
                  const user = db.users.find((u) => u.id === t.ownerId);
                  const priority = PRIORITIES.find((p) => p.value === t.priority);
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      className={cx("cursor-grab rounded-lg border border-stone-200 bg-white p-3 shadow-sm active:cursor-grabbing", dragId === t.id && "opacity-50")}
                    >
                      <Link href={`/tickets/${t.id}`} className="block text-sm font-medium text-teal-700 hover:underline">
                        {t.name}
                      </Link>
                      <p className="mt-1 text-xs text-stone-500">
                        {contact ? displayName("contacts", contact) : "No contact"} · opened {relTime(t.createdAt)}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        {priority && <Badge tone={priority.tone}>{priority.label}</Badge>}
                        {user && <Avatar name={user.name} color={user.color} size={22} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const { db } = useData();
  const [view, setView] = useState<"board" | "table">("board");
  const [creating, setCreating] = useState(false);
  const open = db.tickets.filter((t) => t.status !== "closed");

  return (
    <div>
      <PageHeader title="Tickets" subtitle={`${open.length} open · ${open.filter((t) => t.priority === "high").length} high priority`}>
        <div className="flex rounded-full border border-stone-300 bg-white p-0.5">
          {(["board", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium capitalize", view === v ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100")}
            >
              {v === "board" ? <Columns3 size={15} /> : <Table2 size={15} />}
              {v}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          Create ticket
        </Button>
      </PageHeader>
      {view === "board" ? <Board /> : <ObjectList kind="tickets" hideHeader />}
      <CreateRecordDrawer kind="tickets" open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
