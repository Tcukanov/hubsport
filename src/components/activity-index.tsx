"use client";

import { Phone, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CALL_OUTCOMES } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { displayName } from "@/lib/objects";
import { useCall } from "./call-widget";
import { useData } from "./data";
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, Stat, inputCls } from "./ui";

const COPY = {
  call: { title: "Calls", noun: "call", subject: "Outcome", hint: "Every call logged on a contact, company, deal or ticket." },
  meeting: { title: "Meetings", noun: "meeting", subject: "Meeting", hint: "Every meeting logged on a contact, company, deal or ticket." },
};

const OUTCOME_TONE: Record<string, string> = { Connected: "emerald", "Left voicemail": "amber", "No answer": "stone", "Wrong number": "rose" };

/** The Calls page and the Meetings page: all logged activities of one type, across every record. */
export function ActivityIndex({ type }: { type: "call" | "meeting" }) {
  const copy = COPY[type];
  const { db, log, remove } = useData();
  const dialer = useCall();
  const [user, setUser] = useState("");
  const [outcome, setOutcome] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ contactId: "", subject: type === "call" ? CALL_OUTCOMES[0] : "", body: "" });
  const [nowMs] = useState(() => Date.now());

  const all = db.activities.filter((a) => a.type === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const term = q.trim().toLowerCase();
  const list = all.filter((a) => {
    if (user && a.userId !== user) return false;
    if (outcome && a.subject !== outcome) return false;
    if (!term) return true;
    const contact = db.contacts.find((c) => c.id === a.contactId);
    return `${a.subject ?? ""} ${a.body} ${contact ? displayName("contacts", contact) : ""}`.toLowerCase().includes(term);
  });
  const weekAgo = new Date(nowMs - 7 * 864e5).toISOString();
  const connected = all.filter((a) => a.subject === "Connected").length;

  const save = () => {
    const contact = db.contacts.find((c) => c.id === draft.contactId);
    log({ type, subject: draft.subject.trim(), body: draft.body.trim(), contactId: contact?.id ?? null, companyId: contact?.companyId ?? null });
    setDraft({ contactId: "", subject: type === "call" ? CALL_OUTCOMES[0] : "", body: "" });
    setOpen(false);
  };

  return (
    <div>
      <PageHeader title={copy.title} subtitle={copy.hint}>
        {type === "call" && (
          <Button onClick={() => dialer.open()}>
            <Phone size={16} />
            Make a call
          </Button>
        )}
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={16} />
          Log a {copy.noun}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${copy.title} logged`} value={all.length} />
        <Stat label="Last 7 days" value={all.filter((a) => a.createdAt >= weekAgo).length} />
        {type === "call" ? <Stat label="Connected" value={connected} hint={all.length ? `${Math.round((connected / all.length) * 100)}% of calls` : undefined} /> : <Stat label="Contacts met" value={new Set(all.map((a) => a.contactId).filter(Boolean)).size} />}
        <Stat label="People logging" value={new Set(all.map((a) => a.userId).filter(Boolean)).size} />
      </div>

      <div className="mb-3 mt-5 flex flex-wrap gap-2">
        <input aria-label={`Search ${copy.title.toLowerCase()}`} className={`${inputCls} max-w-xs`} placeholder={`Search ${copy.title.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by user" className={`${inputCls} !w-auto`} value={user} onChange={(e) => setUser(e.target.value)}>
          <option value="">Logged by: all</option>
          {db.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {type === "call" && (
          <select aria-label="Filter by outcome" className={`${inputCls} !w-auto`} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">Outcome: all</option>
            {CALL_OUTCOMES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        )}
      </div>

      <Card className="overflow-x-auto">
        {list.length === 0 ? (
          <Empty title={`No ${copy.title.toLowerCase()} match`} hint={`Log a ${copy.noun} here or from any record page.`} />
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">{copy.subject}</th>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Notes</th>
                <th className="px-4 py-2.5 font-medium">Logged by</th>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {list.slice(0, 200).map((a) => {
                const contact = db.contacts.find((c) => c.id === a.contactId);
                const company = db.companies.find((c) => c.id === a.companyId);
                const who = db.users.find((u) => u.id === a.userId);
                return (
                  <tr key={a.id} className="align-top hover:bg-stone-50">
                    <td className="whitespace-nowrap px-4 py-2.5">{type === "call" ? <Badge tone={OUTCOME_TONE[a.subject ?? ""] ?? "stone"}>{a.subject || "Call"}</Badge> : <span className="font-medium text-stone-900">{a.subject || "Meeting"}</span>}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {contact ? (
                        <Link href={`/contacts/${contact.id}`} className="font-medium text-teal-700 hover:underline">
                          {displayName("contacts", contact)}
                        </Link>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {company ? (
                        <Link href={`/companies/${company.id}`} className="text-teal-700 hover:underline">
                          {company.name}
                        </Link>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="max-w-md px-4 py-2.5 text-stone-600">{a.body || <span className="text-stone-400">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {who && (
                        <span className="inline-flex items-center gap-1.5 text-stone-700">
                          <Avatar name={who.name} color={who.color} size={20} />
                          {who.name}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-stone-600">{fmtDateTime(a.createdAt)}</td>
                    <td className="py-2.5 pr-2">
                      <button type="button" aria-label={`Delete this ${copy.noun}`} onClick={() => remove("activities", a.id)} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-600">
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
        open={open}
        onClose={() => setOpen(false)}
        title={`Log a ${copy.noun}`}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!draft.contactId || (!draft.subject.trim() && !draft.body.trim())} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <Field label="Contact">
          <select className={inputCls} value={draft.contactId} onChange={(e) => setDraft({ ...draft, contactId: e.target.value })}>
            <option value="">Choose a contact…</option>
            {db.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {displayName("contacts", c)}
              </option>
            ))}
          </select>
        </Field>
        {type === "call" ? (
          <Field label="Outcome">
            <select className={inputCls} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}>
              {CALL_OUTCOMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Meeting title">
            <input className={inputCls} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          </Field>
        )}
        <Field label="Notes">
          <textarea rows={4} className={inputCls} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </Field>
      </Modal>
    </div>
  );
}
