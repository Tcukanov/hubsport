"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/data";
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, Tabs, cx, inputCls } from "@/components/ui";
import { PRIORITIES, TASK_TYPES, optionLabel } from "@/lib/config";
import { addDays, fmtDate, todayYmd } from "@/lib/format";
import { displayName } from "@/lib/objects";

type View = "open" | "today" | "overdue" | "upcoming" | "done";

export default function TasksPage() {
  const { db, create, update, remove } = useData();
  const [view, setView] = useState<View>("open");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: "", type: "todo", priority: "medium", dueDate: addDays(1), contactId: "", ownerId: "u_1" });
  const today = todayYmd();

  const groups: Record<View, typeof db.tasks> = {
    open: db.tasks.filter((t) => t.status === "open"),
    today: db.tasks.filter((t) => t.status === "open" && t.dueDate === today),
    overdue: db.tasks.filter((t) => t.status === "open" && t.dueDate < today),
    upcoming: db.tasks.filter((t) => t.status === "open" && t.dueDate > today),
    done: db.tasks.filter((t) => t.status === "done"),
  };
  const list = [...groups[view]].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const save = () => {
    const contact = db.contacts.find((c) => c.id === draft.contactId);
    create("tasks", { ...draft, title: draft.title.trim(), contactId: contact?.id ?? null, companyId: contact?.companyId ?? null, dealId: null, status: "open", notes: "", completedAt: null });
    setDraft((d) => ({ ...d, title: "", contactId: "" }));
    setCreating(false);
  };

  return (
    <div>
      <PageHeader title="Tasks" subtitle={`${groups.open.length} open · ${groups.overdue.length} overdue`}>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          Create task
        </Button>
      </PageHeader>

      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          { value: "open", label: "All open", count: groups.open.length },
          { value: "today", label: "Due today", count: groups.today.length },
          { value: "overdue", label: "Overdue", count: groups.overdue.length },
          { value: "upcoming", label: "Upcoming", count: groups.upcoming.length },
          { value: "done", label: "Completed", count: groups.done.length },
        ]}
      />

      <Card className="mt-4 overflow-x-auto">
        {list.length === 0 ? (
          <Empty title="No tasks in this view" hint="Nice work. Create a task to plan your next follow-up." />
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="w-10 px-3 py-2.5" />
                <th className="px-3 py-2.5 font-medium">Title</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Priority</th>
                <th className="px-3 py-2.5 font-medium">Associated with</th>
                <th className="px-3 py-2.5 font-medium">Due</th>
                <th className="px-3 py-2.5 font-medium">Owner</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {list.map((t) => {
                const contact = db.contacts.find((c) => c.id === t.contactId);
                const deal = db.deals.find((d) => d.id === t.dealId);
                const company = db.companies.find((c) => c.id === t.companyId);
                const user = db.users.find((u) => u.id === t.ownerId);
                const priority = PRIORITIES.find((p) => p.value === t.priority);
                const overdue = t.status === "open" && t.dueDate < today;
                return (
                  <tr key={t.id} className="hover:bg-stone-50">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Mark "${t.title}" complete`}
                        className="h-4 w-4 accent-violet-600"
                        checked={t.status === "done"}
                        onChange={(e) => update("tasks", t.id, { status: e.target.checked ? "done" : "open" })}
                      />
                    </td>
                    <td className={cx("px-3 py-2.5 font-medium", t.status === "done" ? "text-stone-400 line-through" : "text-stone-900")}>{t.title}</td>
                    <td className="px-3 py-2.5 text-stone-600">{optionLabel(TASK_TYPES, t.type)}</td>
                    <td className="px-3 py-2.5">{priority && <Badge tone={priority.tone}>{priority.label}</Badge>}</td>
                    <td className="px-3 py-2.5">
                      {contact ? (
                        <Link className="text-violet-700 hover:underline" href={`/contacts/${contact.id}`}>
                          {displayName("contacts", contact)}
                        </Link>
                      ) : deal ? (
                        <Link className="text-violet-700 hover:underline" href={`/deals/${deal.id}`}>
                          {deal.name}
                        </Link>
                      ) : company ? (
                        <Link className="text-violet-700 hover:underline" href={`/companies/${company.id}`}>
                          {company.name}
                        </Link>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className={cx("whitespace-nowrap px-3 py-2.5", overdue ? "font-medium text-rose-600" : "text-stone-600")}>{fmtDate(t.dueDate)}</td>
                    <td className="px-3 py-2.5">{user && <Avatar name={user.name} color={user.color} size={22} />}</td>
                    <td className="px-3 py-2.5">
                      <button type="button" aria-label="Delete task" onClick={() => remove("tasks", t.id)} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-600">
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

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create a task"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" disabled={!draft.title.trim()} onClick={save}>
              Create
            </Button>
          </>
        }
      >
        <Field label="Task title">
          <input autoFocus className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Due date">
            <input type="date" className={inputCls} value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className={inputCls} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              {TASK_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inputCls} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
              {PRIORITIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Associated contact">
          <select className={inputCls} value={draft.contactId} onChange={(e) => setDraft({ ...draft, contactId: e.target.value })}>
            <option value="">None</option>
            {db.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {displayName("contacts", c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assigned to">
          <select className={inputCls} value={draft.ownerId} onChange={(e) => setDraft({ ...draft, ownerId: e.target.value })}>
            {db.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      </Modal>
    </div>
  );
}
