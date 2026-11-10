"use client";

import { ArrowLeft, Check, LifeBuoy, MailPlus, PenSquare, RotateCcw, StickyNote, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useData } from "@/components/data";
import { Avatar, Badge, Button, Card, Empty, Field, Modal, cx, inputCls } from "@/components/ui";
import { LIFECYCLE, optionLabel } from "@/lib/config";
import { fmtDateTime, relTime } from "@/lib/format";
import { displayName } from "@/lib/objects";
import type { Conversation } from "@/lib/types";

type View = "open" | "mine" | "unassigned" | "closed";

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

const ErrorNote = ({ text }: { text: string }) =>
  text ? (
    <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
      {text}
    </p>
  ) : null;

function Thread({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const { db, me, api, create, update, remove, mail } = useData();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const send = useSubmit();
  const end = useRef<HTMLDivElement>(null);
  const contact = db.contacts.find((c) => c.id === conversation.contactId);
  const company = db.companies.find((c) => c.id === contact?.companyId);
  const messages = db.messages.filter((m) => m.conversationId === conversation.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ticket = db.tickets.find((t) => t.id === conversation.ticketId);
  const closed = conversation.status === "closed";
  const name = contact ? displayName("contacts", contact) : "Unknown sender";

  // Opening a thread marks it as read, and new messages scroll into view.
  useEffect(() => {
    if (conversation.unread) update("conversations", conversation.id, { unread: false });
    end.current?.scrollIntoView({ block: "end" });
  }, [conversation.id, conversation.unread, messages.length, update]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    if (mode === "note") {
      create("messages", { conversationId: conversation.id, body });
      setText("");
    } else if (await send.run(() => api(`inbox/${conversation.id}/reply`, { body }))) setText("");
  };

  return (
    <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-3">
          <button type="button" aria-label="Back to conversations" className="rounded p-1 text-stone-500 hover:bg-stone-100 lg:hidden" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-stone-900">{conversation.subject}</h2>
            <p className="truncate text-xs text-stone-500">
              {name}
              {contact?.email ? ` · ${contact.email}` : ""} · {conversation.channel === "form" ? "from a form" : "email"}
            </p>
          </div>
          <select aria-label="Assignee" className={`${inputCls} !w-auto`} value={conversation.assigneeId ?? ""} onChange={(e) => update("conversations", conversation.id, { assigneeId: e.target.value || null })}>
            <option value="">Unassigned</option>
            {db.users
              .filter((u) => !u.demo)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
          <Button size="sm" onClick={() => update("conversations", conversation.id, { status: closed ? "open" : "closed", unread: false })}>
            {closed ? <RotateCcw size={14} /> : <Check size={14} />}
            {closed ? "Reopen" : "Close"}
          </Button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-stone-50 px-4 py-4">
          {messages.map((m) => {
            const who = db.users.find((u) => u.id === m.userId);
            const mine = m.direction !== "in";
            return (
              <div key={m.id} className={cx("flex gap-2", mine && "flex-row-reverse")}>
                <Avatar name={mine ? (who?.name ?? "Team") : name} color={mine ? (who?.color ?? "#57534e") : "#0f766e"} size={28} />
                <div className={cx("max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm", m.direction === "in" ? "bg-white text-stone-800 shadow-sm" : m.direction === "note" ? "border border-amber-200 bg-amber-50 text-amber-950" : "bg-stone-900 text-white")}>
                  {m.direction === "note" && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Internal note</p>}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={cx("mt-1 text-[11px]", m.direction === "out" ? "text-stone-300" : "text-stone-500")} title={fmtDateTime(m.createdAt)}>
                    {mine ? (who?.name ?? "Team") : name} · {relTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={end} />
        </div>

        <footer className="border-t border-stone-200 p-3">
          <div className="mb-2 flex gap-1">
            {(["reply", "note"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", mode === m ? (m === "note" ? "bg-amber-100 text-amber-900" : "bg-stone-900 text-white") : "text-stone-600 hover:bg-stone-100")}>
                {m === "note" ? <StickyNote size={13} /> : <MailPlus size={13} />}
                {m === "note" ? "Internal note" : "Reply by email"}
              </button>
            ))}
          </div>
          <textarea
            aria-label={mode === "note" ? "Internal note" : "Reply"}
            rows={3}
            className={cx(inputCls, mode === "note" && "!border-amber-300 !bg-amber-50")}
            placeholder={mode === "note" ? "Only your team sees this note." : `Write a reply to ${name}…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={send.busy || !text.trim() || (mode === "reply" && (mail.driver === "none" || !contact?.email))} onClick={submit}>
              {mode === "note" ? "Add note" : send.busy ? "Sending…" : "Send reply"}
            </Button>
            <span className="text-xs text-stone-500">
              {mode === "note"
                ? "Notes are never emailed."
                : mail.driver === "none"
                  ? "Email sending is not set up on this deployment."
                  : mail.driver === "outbox"
                    ? "Development mode: replies are saved to data/outbox."
                    : `Sent from ${mail.from} as ${me.name}.`}
            </span>
          </div>
          <div className="mt-2">
            <ErrorNote text={send.error} />
          </div>
        </footer>
      </div>

      <aside className="hidden space-y-4 overflow-y-auto border-l border-stone-200 p-4 xl:block">
        {contact ? (
          <div>
            <div className="flex items-center gap-3">
              <Avatar name={name} color="#0f766e" size={40} />
              <div className="min-w-0">
                <Link href={`/contacts/${contact.id}`} className="block truncate font-semibold text-teal-700 hover:underline">
                  {name}
                </Link>
                <p className="truncate text-xs text-stone-500">{[contact.jobTitle, company?.name].filter(Boolean).join(" at ") || contact.email}</p>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-stone-500">Lifecycle</dt>
                <dd>
                  <Badge tone={LIFECYCLE.find((l) => l.value === contact.lifecycleStage)?.tone}>{optionLabel(LIFECYCLE, contact.lifecycleStage)}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-500">Open deals</dt>
                <dd className="tabular-nums text-stone-900">{db.deals.filter((d) => d.contactIds.includes(contact.id) && d.stage !== "won" && d.stage !== "lost").length}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-500">Open tickets</dt>
                <dd className="tabular-nums text-stone-900">{db.tickets.filter((t) => t.contactId === contact.id && t.status !== "closed").length}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-stone-500">The contact for this conversation was deleted.</p>
        )}

        <div className="border-t border-stone-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Ticket</p>
          {ticket ? (
            <Link href={`/tickets/${ticket.id}`} className="text-sm font-medium text-teal-700 hover:underline">
              {ticket.name}
            </Link>
          ) : (
            <Button
              size="sm"
              disabled={!contact}
              onClick={() => {
                const first = messages.find((m) => m.direction === "in");
                const t = create("tickets", { name: conversation.subject, description: first?.body ?? "", status: "new", priority: "medium", source: conversation.channel === "form" ? "form" : "email", contactId: contact?.id ?? null, companyId: contact?.companyId ?? null, ownerId: conversation.assigneeId ?? me.id, closedAt: null });
                update("conversations", conversation.id, { ticketId: t.id });
              }}
            >
              <LifeBuoy size={14} />
              Create ticket
            </Button>
          )}
        </div>

        <div className="border-t border-stone-100 pt-4">
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (!window.confirm("Delete this conversation and its messages?")) return;
              remove("conversations", conversation.id);
              onBack();
            }}
          >
            <Trash2 size={14} />
            Delete conversation
          </Button>
        </div>
      </aside>
    </div>
  );
}

export default function InboxPage() {
  const { db, me, api, mail } = useData();
  const [view, setView] = useState<View>("open");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<"compose" | "simulate" | null>(null);
  const [draft, setDraft] = useState({ contactId: "", email: "", name: "", subject: "", body: "" });
  const action = useSubmit();

  const sorted = [...db.conversations].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const groups: Record<View, Conversation[]> = {
    open: sorted.filter((c) => c.status === "open"),
    mine: sorted.filter((c) => c.status === "open" && c.assigneeId === me.id),
    unassigned: sorted.filter((c) => c.status === "open" && !c.assigneeId),
    closed: sorted.filter((c) => c.status === "closed"),
  };
  const term = q.trim().toLowerCase();
  const list = groups[view].filter((c) => {
    if (!term) return true;
    const contact = db.contacts.find((x) => x.id === c.contactId);
    return `${c.subject} ${contact ? displayName("contacts", contact) : ""} ${contact?.email ?? ""}`.toLowerCase().includes(term);
  });
  const current = db.conversations.find((c) => c.id === selected) ?? null;

  const closeModal = () => {
    setModal(null);
    setDraft({ contactId: "", email: "", name: "", subject: "", body: "" });
  };
  const submitModal = async () => {
    const ok = await action.run(async () => {
      const r = modal === "compose" ? await api<{ id: string }>("inbox/new", { contactId: draft.contactId, subject: draft.subject, body: draft.body }) : await api<{ id: string }>("inbox/simulate", { email: draft.email, name: draft.name, subject: draft.subject, body: draft.body });
      setSelected(r.id);
      setView("open");
    });
    if (ok) closeModal();
  };

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-57px)] lg:-mx-8">
      <div className={cx("w-full shrink-0 flex-col border-r border-stone-200 bg-white lg:flex lg:w-80", current ? "hidden" : "flex")}>
        <div className="space-y-3 border-b border-stone-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-stone-900">Inbox</h1>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => setModal("simulate")} title="Add a pretend incoming email, to try the inbox without a mail provider">
                Test email
              </Button>
              <Button size="sm" variant="primary" onClick={() => setModal("compose")}>
                <PenSquare size={13} />
                Compose
              </Button>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {(["open", "mine", "unassigned", "closed"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={cx("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize", view === v ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100")}>
                {v === "mine" ? "Assigned to me" : v} {groups[v].length}
              </button>
            ))}
          </div>
          <input aria-label="Search conversations" className={inputCls} placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto">
          {list.length === 0 && <li className="px-4 py-8 text-center text-sm text-stone-500">No conversations here.</li>}
          {list.map((c) => {
            const contact = db.contacts.find((x) => x.id === c.contactId);
            const last = db.messages.filter((m) => m.conversationId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            const assignee = db.users.find((u) => u.id === c.assigneeId);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setSelected(c.id)} className={cx("flex w-full gap-2.5 px-3 py-3 text-left hover:bg-stone-50", selected === c.id && "bg-stone-100")}>
                  <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", c.unread ? "bg-teal-600" : "bg-transparent")} aria-label={c.unread ? "Unread" : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cx("truncate text-sm", c.unread ? "font-semibold text-stone-900" : "font-medium text-stone-800")}>{contact ? displayName("contacts", contact) : "Unknown sender"}</span>
                      <span className="shrink-0 text-xs text-stone-400">{relTime(c.lastMessageAt)}</span>
                    </span>
                    <span className={cx("block truncate text-sm", c.unread ? "font-medium text-stone-900" : "text-stone-700")}>{c.subject}</span>
                    <span className="block truncate text-xs text-stone-500">
                      {last?.direction === "out" ? "You: " : last?.direction === "note" ? "Note: " : ""}
                      {last?.body}
                    </span>
                  </span>
                  {assignee && <Avatar name={assignee.name} color={assignee.color} size={20} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={cx("min-w-0 flex-1 flex-col bg-white lg:flex", current ? "flex" : "hidden")}>
        {current ? (
          <Thread key={current.id} conversation={current} onBack={() => setSelected(null)} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <Card>
              <Empty title="Select a conversation" hint="Replies to your emails and messages from forms land here. Answer by email or leave an internal note for your team." />
            </Card>
          </div>
        )}
      </div>

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal === "compose" ? "New conversation" : "Add a test incoming email"}
        footer={
          <>
            <Button onClick={closeModal}>Cancel</Button>
            <Button variant="primary" disabled={action.busy || !draft.body.trim() || (modal === "compose" ? !draft.contactId || !draft.subject.trim() || mail.driver === "none" : !draft.email.includes("@"))} onClick={submitModal}>
              {modal === "compose" ? (action.busy ? "Sending…" : "Send") : "Add to inbox"}
            </Button>
          </>
        }
      >
        {modal === "compose" ? (
          <Field label="To">
            <select className={inputCls} value={draft.contactId} onChange={(e) => setDraft({ ...draft, contactId: e.target.value })}>
              <option value="">Choose a contact…</option>
              {db.contacts
                .filter((c) => c.email)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {displayName("contacts", c)} &lt;{c.email}&gt;
                  </option>
                ))}
            </select>
          </Field>
        ) : (
          <>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">This puts a pretend email into the inbox as if someone had written to you. Nothing is sent. Real incoming email needs the webhook from Settings connected at your mail provider.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From (email)">
                <input type="email" className={inputCls} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </Field>
              <Field label="Sender name">
                <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
            </div>
          </>
        )}
        <Field label="Subject">
          <input className={inputCls} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </Field>
        <Field label="Message">
          <textarea rows={5} className={inputCls} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </Field>
        <ErrorNote text={action.error} />
      </Modal>
    </div>
  );
}
