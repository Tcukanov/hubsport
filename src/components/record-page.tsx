"use client";

import { ArrowLeft, CalendarDays, CheckSquare, Mail, Phone, Plus, StickyNote, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CALL_OUTCOMES, DEAL_STAGES, ORDER_STATUS, PRIORITIES, TASK_TYPES, TICKET_STATUS, optionLabel } from "@/lib/config";
import { addDays, fmtDate, money, todayYmd } from "@/lib/format";
import { OBJECTS, displayName, type ObjectKind } from "@/lib/objects";
import type { AnyRec, Task } from "@/lib/types";
import { useData } from "./data";
import { LineItems, lineTotal } from "./line-items";
import { PropField, PropValue } from "./props";
import { ActivityItem } from "./timeline";
import { Avatar, Button, Card, Empty, Field, Modal, Tabs, cx, inputCls } from "./ui";

type Composer = "note" | "email" | "call" | "meeting" | "task";

const ACTIONS: { type: Composer; label: string; icon: typeof Mail }[] = [
  { type: "note", label: "Note", icon: StickyNote },
  { type: "email", label: "Email", icon: Mail },
  { type: "call", label: "Call", icon: Phone },
  { type: "task", label: "Task", icon: CheckSquare },
  { type: "meeting", label: "Meeting", icon: CalendarDays },
];

function ComposerModal({
  type,
  links,
  recipients,
  phones,
  onClose,
}: {
  type: Composer;
  links: { contactId: string | null; companyId: string | null; dealId: string | null; ticketId: string | null };
  /** Contacts an email can go to from this record. */
  recipients: { id: string; label: string }[];
  /** Contacts with a phone number that can be called from this record. */
  phones: { id: string; label: string; phone: string }[];
  onClose: () => void;
}) {
  const { log, create, api, me, mail, telephony } = useData();
  const [callee, setCallee] = useState(phones[0]?.id ?? "");
  const [ringing, setRinging] = useState(false);
  const target = phones.find((p) => p.id === callee);
  const [to, setTo] = useState(recipients[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState(type === "call" ? CALL_OUTCOMES[0] : "");
  const [body, setBody] = useState("");
  const [due, setDue] = useState(addDays(1));
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("todo");

  const titles: Record<Composer, string> = { note: "Add a note", email: "Send an email", call: "Log a call", meeting: "Log a meeting", task: "Create a task" };
  const ok = type === "task" ? subject.trim() : type === "note" ? body.trim() : type === "email" ? to && subject.trim() && body.trim() && mail.driver !== "none" : subject.trim() || body.trim();

  const save = async () => {
    if (type === "email") {
      setBusy(true);
      setError("");
      try {
        await api("send-email", { contactId: to, subject: subject.trim(), body: body.trim(), dealId: links.dealId, ticketId: links.ticketId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sending failed.");
        setBusy(false);
        return;
      }
    } else if (type === "task") {
      create("tasks", { title: subject.trim(), type: taskType, priority, dueDate: due, status: "open", ownerId: me.id, notes: body, completedAt: null, ...links });
    } else {
      log({ type, subject: type === "note" ? undefined : subject.trim(), body: body.trim(), ...links });
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={titles[type]}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ok || busy} onClick={save}>
            {type === "email" ? (busy ? "Sending…" : "Send") : "Save"}
          </Button>
        </>
      }
    >
      {type === "email" && (
        <Field label="To">
          <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>
            {recipients.length === 0 && <option value="">No associated contact with an email address</option>}
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {type === "call" && phones.length > 0 && (
        <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Who to call" className={`${inputCls} !w-auto flex-1`} value={callee} onChange={(e) => setCallee(e.target.value)}>
              {phones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {p.phone}
                </option>
              ))}
            </select>
            {telephony ? (
              <Button
                variant="primary"
                disabled={busy || ringing || !target}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api("calls/start", { contactId: callee, dealId: links.dealId, ticketId: links.ticketId });
                    setRinging(true);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "The call could not be started.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Phone size={15} />
                {ringing ? "Ringing your phone…" : "Call now"}
              </Button>
            ) : (
              target && (
                <a href={`tel:${target.phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-700">
                  <Phone size={15} />
                  Call with your phone
                </a>
              )
            )}
          </div>
          <p className="text-xs text-stone-500">
            {ringing
              ? "Pick up your phone to be connected. The call is already on the timeline and updates when it ends, so you can close this window."
              : telephony
                ? "Your own phone rings first, then you are connected to the contact. The call is logged automatically."
                : "Opens your phone or calling app. Log the outcome below when you are done."}
          </p>
        </div>
      )}
      {type === "call" && (
        <Field label="Outcome">
          <select className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)}>
            {CALL_OUTCOMES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
      )}
      {(type === "email" || type === "meeting" || type === "task") && (
        <Field label={type === "task" ? "Task title" : type === "email" ? "Subject" : "Meeting title"}>
          <input autoFocus className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
      )}
      {type === "task" && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Due date">
            <input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Type">
            <select className={inputCls} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
              {TASK_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <Field label={type === "note" ? "Note" : type === "email" ? "Email body" : "Notes"}>
        <textarea autoFocus={type === "note" || type === "call"} rows={5} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {type === "email" && (
        <p className="text-xs text-stone-500">
          {mail.driver === "none"
            ? "Email sending is not set up on this deployment yet."
            : mail.driver === "outbox"
              ? "Development mode: the message is saved to data/outbox instead of being delivered."
              : `Sent for real from ${mail.from}, with replies going to ${me.email}. It is also logged on the timeline.`}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      )}
    </Modal>
  );
}

function AssocCard({
  title,
  items,
  options,
  onAdd,
  onRemove,
}: {
  title: string;
  items: { id: string; href: string; label: string; sub?: string }[];
  options?: { value: string; label: string }[];
  onAdd?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Card
      title={`${title} (${items.length})`}
      action={
        onAdd && (
          <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline" onClick={() => setAdding((v) => !v)}>
            <Plus size={13} />
            Add
          </button>
        )
      }
    >
      {adding && options && (
        <div className="border-b border-stone-100 p-3">
          <select
            aria-label={`Add ${title}`}
            className={inputCls}
            value=""
            onChange={(e) => {
              if (e.target.value) onAdd?.(e.target.value);
              setAdding(false);
            }}
          >
            <option value="">Choose…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {items.length === 0 && <p className="px-4 py-4 text-sm text-stone-500">None yet.</p>}
      <ul className="divide-y divide-stone-100">
        {items.map((it) => (
          <li key={it.id} className="group flex items-center justify-between gap-2 px-4 py-2.5">
            <div className="min-w-0">
              <Link href={it.href} className="block truncate text-sm font-medium text-teal-700 hover:underline">
                {it.label}
              </Link>
              {it.sub && <span className="block truncate text-xs text-stone-500">{it.sub}</span>}
            </div>
            {onRemove && (
              <button type="button" aria-label={`Remove ${it.label}`} onClick={() => onRemove(it.id)} className="rounded p-1 text-stone-400 opacity-0 hover:bg-stone-100 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100">
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TaskRow({ task }: { task: Task }) {
  const { update, remove } = useData();
  const overdue = task.status === "open" && task.dueDate < todayYmd();
  return (
    <li className="group flex items-center gap-3 px-4 py-3">
      <input
        type="checkbox"
        aria-label={`Mark "${task.title}" complete`}
        className="h-4 w-4 accent-teal-600"
        checked={task.status === "done"}
        onChange={(e) => update("tasks", task.id, { status: e.target.checked ? "done" : "open" })}
      />
      <div className="min-w-0 flex-1">
        <p className={cx("truncate text-sm font-medium", task.status === "done" ? "text-stone-400 line-through" : "text-stone-900")}>{task.title}</p>
        <p className={cx("text-xs", overdue ? "text-rose-600" : "text-stone-500")}>Due {fmtDate(task.dueDate)}</p>
      </div>
      <button type="button" aria-label="Delete task" onClick={() => remove("tasks", task.id)} className="rounded p-1 text-stone-400 opacity-0 hover:bg-stone-100 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100">
        <Trash2 size={15} />
      </button>
    </li>
  );
}

export function RecordPage({ kind }: { kind: ObjectKind }) {
  const cfg = OBJECTS[kind];
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, update, remove } = useData();
  const [tab, setTab] = useState("all");
  const [composer, setComposer] = useState<Composer | null>(null);
  const rec = (db[kind] as AnyRec[]).find((r) => r.id === id);

  const contactIdsOfCompany = useMemo(() => new Set(kind === "companies" ? db.contacts.filter((c) => c.companyId === id).map((c) => c.id) : []), [db.contacts, kind, id]);

  if (!rec)
    return (
      <Empty title={`${cfg.singular} not found`} hint="It may have been deleted.">
        <Link href={cfg.path} className="text-sm text-teal-700 hover:underline">
          Back to {cfg.plural.toLowerCase()}
        </Link>
      </Empty>
    );

  const name = displayName(kind, rec);
  const none = { contactId: null, companyId: null, dealId: null, ticketId: null };
  const links =
    kind === "contacts"
      ? { ...none, contactId: id, companyId: rec.companyId ?? null }
      : kind === "companies"
        ? { ...none, companyId: id }
        : kind === "deals"
          ? { ...none, companyId: rec.companyId ?? null, dealId: id }
          : { ...none, contactId: rec.contactId ?? null, companyId: rec.companyId ?? null, ticketId: kind === "tickets" ? id : null };

  const mine = (x: { contactId: string | null; companyId: string | null; dealId: string | null; ticketId?: string | null }) =>
    kind === "contacts"
      ? x.contactId === id
      : kind === "deals"
        ? x.dealId === id
        : kind === "tickets"
          ? x.ticketId === id
          : kind === "companies"
            ? x.companyId === id || (!!x.contactId && contactIdsOfCompany.has(x.contactId))
            : false;

  const reachable =
    kind === "contacts"
      ? [rec]
      : kind === "companies"
        ? db.contacts.filter((c) => c.companyId === id)
        : kind === "deals"
          ? db.contacts.filter((c) => rec.contactIds.includes(c.id))
          : db.contacts.filter((c) => c.id === rec.contactId);
  const recipients = reachable.filter((c) => c.email).map((c) => ({ id: c.id as string, label: `${displayName("contacts", c)} <${c.email}>` }));

  const phones = reachable.filter((c) => c.phone).map((c) => ({ id: c.id as string, label: displayName("contacts", c), phone: c.phone as string }));

  const activities = db.activities.filter(mine).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const tasks = db.tasks.filter(mine).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const shown = tab === "all" ? activities : activities.filter((a) => a.type === tab);
  const count = (t: string) => activities.filter((a) => a.type === t).length;

  const dealItem = (d: AnyRec) => ({ id: d.id, href: `/deals/${d.id}`, label: d.name, sub: `${money(d.amount)} · ${DEAL_STAGES.find((s) => s.value === d.stage)?.label}` });
  const ticketItem = (t: AnyRec) => ({ id: t.id, href: `/tickets/${t.id}`, label: t.name, sub: optionLabel(TICKET_STATUS, t.status) });
  const orderItem = (o: AnyRec) => ({ id: o.id, href: `/orders/${o.id}`, label: o.name, sub: `${money(o.amount)} · ${optionLabel(ORDER_STATUS, o.status)}` });
  const linkedContact = db.contacts.find((c) => c.id === rec.contactId);
  const stageDef = cfg.props.find((p) => p.key === cfg.stageKey);
  const usesProduct = <T extends { lineItems?: { productId: string | null }[] }>(list: T[]) => list.filter((x) => x.lineItems?.some((li) => li.productId === id));
  const contactItem = (c: AnyRec) => ({ id: c.id, href: `/contacts/${c.id}`, label: displayName("contacts", c), sub: c.jobTitle || c.email });
  const company = db.companies.find((c) => c.id === rec.companyId);
  const companyItems = company ? [{ id: company.id, href: `/companies/${company.id}`, label: company.name, sub: company.domain }] : [];

  return (
    <div>
      <Link href={cfg.path} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft size={15} />
        {cfg.plural}
      </Link>

      {stageDef?.options && (
        <div className="mb-5 flex overflow-x-auto rounded-xl border border-stone-200 bg-white p-1.5">
          {stageDef.options.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => update(kind, id, { [stageDef.key]: s.value })}
              className={cx(
                "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium",
                rec[stageDef.key] === s.value ? (s.tone === "rose" ? "bg-rose-600 text-white" : s.tone === "emerald" ? "bg-emerald-600 text-white" : "bg-stone-900 text-white") : "text-stone-600 hover:bg-stone-100",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-3 px-4 pt-4">
              <Avatar name={name} color={{ contacts: "#0f766e", companies: "#0d9488", deals: "#d97706", tickets: "#2563eb", products: "#57534e", orders: "#059669" }[kind]} size={44} />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-stone-900">{name}</h1>
                <p className="truncate text-sm text-stone-500">
                  {kind === "contacts"
                    ? [rec.jobTitle, company?.name].filter(Boolean).join(" at ") || rec.email
                    : kind === "companies"
                      ? rec.domain
                      : kind === "tickets"
                        ? `${optionLabel(TICKET_STATUS, rec.status)} · ${optionLabel(PRIORITIES, rec.priority)} priority`
                        : kind === "products"
                          ? `${money(rec.price)} · ${rec.sku || "no SKU"}`
                          : money(rec.amount)}
                </p>
              </div>
            </div>
            <div className={cx("flex justify-between gap-1 px-3 py-4", !cfg.timeline && "hidden")}>
              {ACTIONS.map((a) => (
                <button key={a.type} type="button" onClick={() => setComposer(a.type)} className="flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-xs text-stone-600 hover:bg-stone-100">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700">
                    <a.icon size={15} />
                  </span>
                  {a.label}
                </button>
              ))}
            </div>
          </Card>

          <Card title={`About this ${cfg.singular.toLowerCase()}`}>
            <div className="space-y-3 p-4">
              {cfg.props.map((def) => (
                <div key={def.key}>
                  <span className="mb-1 block text-xs font-medium text-stone-500">{def.label}</span>
                  {def.readOnly ? (
                    <p className="text-sm text-stone-800">
                      <PropValue def={def} rec={rec} db={db} />
                    </p>
                  ) : (
                    <PropField def={def} value={rec[def.key]} db={db} onChange={(v) => update(kind, id, { [def.key]: v })} />
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
              remove(kind, id);
              router.push(cfg.path);
            }}
          >
            <Trash2 size={15} />
            Delete {cfg.singular.toLowerCase()}
          </Button>
        </div>

        <div className="min-w-0 space-y-5">
          {kind === "deals" && (
            <LineItems
              items={rec.lineItems}
              onChange={(lineItems) => update("deals", id, { lineItems })}
              footer={
                lineTotal(rec.lineItems) > 0 &&
                lineTotal(rec.lineItems) !== rec.amount && (
                  <button type="button" className="text-sm font-medium text-teal-700 hover:underline" onClick={() => update("deals", id, { amount: lineTotal(rec.lineItems) })}>
                    Use total as deal amount
                  </button>
                )
              }
            />
          )}
          {kind === "orders" && <LineItems items={rec.lineItems} onChange={(lineItems) => update("orders", id, { lineItems, amount: lineTotal(lineItems) })} />}
          {kind === "products" && (
            <>
              <AssocCard title="Deals with this product" items={usesProduct(db.deals).map(dealItem)} />
              <AssocCard title="Orders with this product" items={usesProduct(db.orders).map(orderItem)} />
            </>
          )}
          {cfg.timeline && (
            <div>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "all", label: "Activity", count: activities.length },
              { value: "note", label: "Notes", count: count("note") },
              { value: "email", label: "Emails", count: count("email") },
              { value: "call", label: "Calls", count: count("call") },
              { value: "tasks", label: "Tasks", count: tasks.length },
              { value: "meeting", label: "Meetings", count: count("meeting") },
            ]}
          />
          <Card className="mt-4">
            {tab === "tasks" ? (
              tasks.length ? (
                <ul className="divide-y divide-stone-100">
                  {tasks.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </ul>
              ) : (
                <Empty title="No tasks yet" hint="Create a task to remember a follow-up.">
                  <Button size="sm" onClick={() => setComposer("task")}>
                    Create task
                  </Button>
                </Empty>
              )
            ) : shown.length ? (
              <ul className="divide-y divide-stone-100">
                {shown.map((a) => (
                  <ActivityItem key={a.id} a={a} showTarget={kind === "companies"} />
                ))}
              </ul>
            ) : (
              <Empty title="Nothing here yet" hint="Log a note, call, email or meeting and it will show up on this timeline." />
            )}
          </Card>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {kind === "contacts" && (
            <>
              <AssocCard title="Company" items={companyItems} />
              <AssocCard
                title="Deals"
                items={db.deals.filter((d) => d.contactIds.includes(id)).map(dealItem)}
                options={db.deals.filter((d) => !d.contactIds.includes(id)).map((d) => ({ value: d.id, label: d.name }))}
                onAdd={(dealId) => update("deals", dealId, { contactIds: [...db.deals.find((d) => d.id === dealId)!.contactIds, id] })}
                onRemove={(dealId) => update("deals", dealId, { contactIds: db.deals.find((d) => d.id === dealId)!.contactIds.filter((x) => x !== id) })}
              />
              <AssocCard title="Tickets" items={db.tickets.filter((t) => t.contactId === id).map(ticketItem)} />
              <AssocCard title="Orders" items={db.orders.filter((o) => o.contactId === id).map(orderItem)} />
            </>
          )}
          {kind === "companies" && (
            <>
              <AssocCard
                title="Contacts"
                items={db.contacts.filter((c) => c.companyId === id).map(contactItem)}
                options={db.contacts.filter((c) => c.companyId !== id).map((c) => ({ value: c.id, label: displayName("contacts", c) }))}
                onAdd={(cid) => update("contacts", cid, { companyId: id })}
                onRemove={(cid) => update("contacts", cid, { companyId: null })}
              />
              <AssocCard
                title="Deals"
                items={db.deals.filter((d) => d.companyId === id).map(dealItem)}
                options={db.deals.filter((d) => d.companyId !== id).map((d) => ({ value: d.id, label: d.name }))}
                onAdd={(did) => update("deals", did, { companyId: id })}
                onRemove={(did) => update("deals", did, { companyId: null })}
              />
              <AssocCard title="Tickets" items={db.tickets.filter((t) => t.companyId === id).map(ticketItem)} />
            </>
          )}
          {(kind === "tickets" || kind === "orders") && (
            <>
              <AssocCard title="Contact" items={linkedContact ? [contactItem(linkedContact)] : []} />
              <AssocCard title="Company" items={companyItems} />
            </>
          )}
          {kind === "products" && (
            <Card title="Usage">
              <dl className="space-y-2 p-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-stone-600">On deals</dt>
                  <dd className="font-medium tabular-nums text-stone-900">{usesProduct(db.deals).length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-600">On orders</dt>
                  <dd className="font-medium tabular-nums text-stone-900">{usesProduct(db.orders).length}</dd>
                </div>
              </dl>
            </Card>
          )}
          {kind === "deals" && (
            <>
              <AssocCard title="Company" items={companyItems} />
              <AssocCard
                title="Contacts"
                items={db.contacts.filter((c) => rec.contactIds.includes(c.id)).map(contactItem)}
                options={db.contacts.filter((c) => !rec.contactIds.includes(c.id)).map((c) => ({ value: c.id, label: displayName("contacts", c) }))}
                onAdd={(cid) => update("deals", id, { contactIds: [...rec.contactIds, cid] })}
                onRemove={(cid) => update("deals", id, { contactIds: rec.contactIds.filter((x: string) => x !== cid) })}
              />
            </>
          )}
        </div>
      </div>

      {composer && <ComposerModal type={composer} links={links} recipients={recipients} phones={phones} onClose={() => setComposer(null)} />}
    </div>
  );
}
