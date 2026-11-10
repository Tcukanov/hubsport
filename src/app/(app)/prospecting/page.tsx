"use client";

import { Send as SendIcon, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useData } from "@/components/data";
import { Badge, Button, Card, Empty, Field, PageHeader, Stat, Tabs, inputCls } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { displayName } from "@/lib/objects";
import { segmentContacts } from "@/lib/segments";
import type { Prospect } from "@/lib/types";

const MAX = 8;

function DraftCard({ p }: { p: Prospect }) {
  const { db, update, api, mail } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const contact = db.contacts.find((c) => c.id === p.contactId);
  const company = db.companies.find((c) => c.id === contact?.companyId);
  if (!contact) return null;
  const draft = p.status === "draft";

  return (
    <Card>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/contacts/${contact.id}`} className="font-semibold text-teal-700 hover:underline">
            {displayName("contacts", contact)}
          </Link>
          <span className="text-sm text-stone-500">{[contact.jobTitle, company?.name].filter(Boolean).join(" at ")}</span>
          <span className="ml-auto flex items-center gap-2">
            <Badge tone={p.generatedBy === "ai" ? "violet" : "stone"}>{p.generatedBy === "ai" ? "Written by AI" : "Template"}</Badge>
            {!draft && <Badge tone={p.status === "sent" ? "emerald" : "stone"}>{p.status === "sent" ? `Sent ${fmtDateTime(p.sentAt!)}` : "Dismissed"}</Badge>}
          </span>
        </div>
        <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
          <span className="font-medium text-stone-900">Research: </span>
          {p.research}
        </p>
        {draft ? (
          <>
            <Field label="Subject">
              <input className={inputCls} value={p.subject} onChange={(e) => update("prospects", p.id, { subject: e.target.value })} />
            </Field>
            <Field label={`Message to ${contact.email}`}>
              <textarea rows={7} className={inputCls} value={p.body} onChange={(e) => update("prospects", p.id, { body: e.target.value })} />
            </Field>
            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={busy || mail.driver === "none" || !p.subject.trim() || !p.body.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api(`prospecting/${p.id}/send`, {});
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Sending failed.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <SendIcon size={15} />
                {busy ? "Sending…" : "Approve and send"}
              </Button>
              <Button disabled={busy} onClick={() => update("prospects", p.id, { status: "dismissed" })}>
                <X size={15} />
                Dismiss
              </Button>
            </div>
          </>
        ) : (
          <div className="text-sm text-stone-700">
            <p className="font-medium text-stone-900">{p.subject}</p>
            <p className="mt-1 whitespace-pre-wrap">{p.body}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ProspectingPage() {
  const { db, api, ai, mail } = useData();
  const [tab, setTab] = useState<"draft" | "sent" | "dismissed">("draft");
  const [segmentId, setSegmentId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pitch, setPitch] = useState("");
  const [tone, setTone] = useState("Friendly and direct");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Remember the pitch between visits (a per-browser convenience, not CRM data).
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pipeline-pitch");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setPitch(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const drafted = new Set(db.prospects.filter((p) => p.status === "draft").map((p) => p.contactId));
  const contacted = new Set(db.prospects.filter((p) => p.status === "sent").map((p) => p.contactId));
  const segment = db.segments.find((s) => s.id === segmentId);
  const candidates = (segment ? segmentContacts(segment, db.contacts) : db.contacts)
    .filter((c) => c.email && !drafted.has(c.id) && !contacted.has(c.id) && c.lifecycleStage !== "customer")
    .slice(0, 40);
  const lists = { draft: db.prospects.filter((p) => p.status === "draft"), sent: db.prospects.filter((p) => p.status === "sent"), dismissed: db.prospects.filter((p) => p.status === "dismissed") };

  const run = async () => {
    setBusy(true);
    setMessage(null);
    try {
      localStorage.setItem("pipeline-pitch", pitch);
    } catch {
      /* storage unavailable */
    }
    try {
      const r = await api<{ created: number; ai: number }>("prospecting/run", { contactIds: [...picked], pitch, tone });
      setMessage({ ok: true, text: `${r.created} draft${r.created === 1 ? "" : "s"} ready for review${r.ai ? "" : " (template drafts)"}.` });
      setPicked(new Set());
      setTab("draft");
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "The agent could not run." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Prospecting agent" subtitle="Picks up what the CRM knows about a contact, drafts a first email, and waits for your approval before anything is sent." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Drafts to review" value={lists.draft.length} />
        <Stat label="Sent" value={lists.sent.length} />
        <Stat label="Dismissed" value={lists.dismissed.length} />
        <Stat label="Drafting" value={ai ? "AI" : "Template"} hint={ai ? "Claude writes each draft" : "Set ANTHROPIC_API_KEY for AI drafts"} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Card title="Run the agent">
          <div className="space-y-3 p-4">
            <Field label="What are you offering?">
              <textarea rows={3} className={inputCls} placeholder="e.g. We run private harbour cruises for team events, 20 to 150 guests." value={pitch} onChange={(e) => setPitch(e.target.value)} />
            </Field>
            <Field label="Tone">
              <select className={inputCls} value={tone} onChange={(e) => setTone(e.target.value)}>
                {["Friendly and direct", "Formal", "Casual and brief", "Warm and consultative"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Choose from">
              <select
                className={inputCls}
                value={segmentId}
                onChange={(e) => {
                  setSegmentId(e.target.value);
                  setPicked(new Set());
                }}
              >
                <option value="">All contacts who are not customers yet</option>
                {db.segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    Segment: {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-stone-600">
                <span>
                  Contacts ({picked.size} of up to {MAX} selected)
                </span>
                <button type="button" className="font-medium text-teal-700 hover:underline" onClick={() => setPicked(new Set(candidates.slice(0, 5).map((c) => c.id)))}>
                  Pick first 5
                </button>
              </div>
              <ul className="max-h-64 divide-y divide-stone-100 overflow-y-auto rounded-md border border-stone-200">
                {candidates.length === 0 && <li className="px-3 py-3 text-sm text-stone-500">No contacts left to prospect in this list.</li>}
                {candidates.map((c) => {
                  const company = db.companies.find((x) => x.id === c.companyId);
                  const on = picked.has(c.id);
                  return (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-stone-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={on}
                          disabled={!on && picked.size >= MAX}
                          onChange={() =>
                            setPicked((s) => {
                              const next = new Set(s);
                              if (on) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-stone-900">{displayName("contacts", c)}</span>
                          <span className="block truncate text-xs text-stone-500">{[c.jobTitle, company?.name].filter(Boolean).join(" at ")}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
            <Button variant="primary" className="w-full" disabled={busy || picked.size === 0} onClick={run}>
              <Sparkles size={15} />
              {busy ? "Researching and drafting…" : `Draft ${picked.size || ""} outreach email${picked.size === 1 ? "" : "s"}`}
            </Button>
            {message && (
              <p role={message.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
                {message.text}
              </p>
            )}
            <p className="text-xs text-stone-500">The agent only uses facts stored on the contact, their company and their timeline. Nothing is sent until you approve a draft.</p>
          </div>
        </Card>

        <div className="min-w-0">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "draft", label: "To review", count: lists.draft.length },
              { value: "sent", label: "Sent", count: lists.sent.length },
              { value: "dismissed", label: "Dismissed", count: lists.dismissed.length },
            ]}
          />
          {mail.driver === "none" && tab === "draft" && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Email sending is not set up on this deployment, so drafts can be reviewed but not sent yet.</p>}
          <div className="mt-4 space-y-4">
            {lists[tab].length === 0 ? (
              <Card>
                <Empty title={tab === "draft" ? "No drafts waiting" : `Nothing ${tab} yet`} hint={tab === "draft" ? "Select a few contacts on the left and run the agent." : undefined} />
              </Card>
            ) : (
              lists[tab].map((p) => <DraftCard key={p.id} p={p} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
