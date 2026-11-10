"use client";

import { ArrowLeft, Check, Copy, Send as SendIcon, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "@/components/data";
import { Badge, Button, Card, Empty, Field, Modal, Stat, Tabs, inputCls } from "@/components/ui";
import { fmtDateTime, pct } from "@/lib/format";
import { emailRecipients } from "@/lib/mutations";
import { displayName } from "@/lib/objects";
import { renderTokens } from "@/lib/segments";
import type { DB, MarketingEmail } from "@/lib/types";

function Preview({ email, db }: { email: MarketingEmail; db: DB }) {
  const sample = emailRecipients(db, email.segmentId)[0] ?? db.contacts[0];
  const company = db.companies.find((c) => c.id === sample?.companyId);
  const t = (s: string) => renderTokens(s, sample, company);
  return (
    <div className="bg-stone-100 p-5">
      <div className="mx-auto max-w-lg overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-5 py-3 text-sm">
          <p className="font-semibold text-stone-900">{t(email.subject) || "No subject"}</p>
          <p className="text-xs text-stone-500">
            {email.fromName} &lt;{email.fromEmail}&gt; · to {sample ? displayName("contacts", sample) : "nobody"}
          </p>
          {email.previewText && <p className="mt-1 text-xs text-stone-400">{t(email.previewText)}</p>}
        </div>
        <div className="space-y-3 px-5 py-5 text-sm leading-relaxed text-stone-800">
          {t(email.body)
            .split(/\n{2,}/)
            .map((p, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {p}
              </p>
            ))}
          {email.ctaLabel && <span className="inline-block rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white">{email.ctaLabel}</span>}
        </div>
        <div className="border-t border-stone-100 px-5 py-3 text-center text-xs text-stone-400">You are receiving this because you subscribed. Unsubscribe</div>
      </div>
    </div>
  );
}

const Mark = ({ on }: { on: boolean }) => (on ? <Check size={15} className="text-emerald-600" aria-label="Yes" /> : <X size={15} className="text-stone-300" aria-label="No" />);

export default function EmailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, update, create, api, mail } = useData();
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [tab, setTab] = useState<"performance" | "content">("performance");
  const email = db.emails.find((e) => e.id === id);

  if (!email)
    return (
      <Empty title="Email not found">
        <Link href="/emails" className="text-sm text-violet-700 hover:underline">
          Back to emails
        </Link>
      </Empty>
    );

  const set = (patch: Record<string, unknown>) => update("emails", id, patch);
  const sent = email.status === "sent";
  const recipients = emailRecipients(db, email.segmentId);
  const sends = db.sends.filter((s) => s.emailId === id);
  const delivered = sends.filter((s) => s.delivered).length;
  const opened = sends.filter((s) => s.opened).length;
  const clicked = sends.filter((s) => s.clicked).length;
  const segment = db.segments.find((s) => s.id === email.segmentId);

  const clone = () => {
    const copy = create("emails", { ...email, name: `${email.name} (copy)`, status: "draft", sentAt: null });
    router.push(`/emails/${copy.id}`);
  };

  return (
    <div>
      <Link href="/emails" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft size={15} />
        Marketing emails
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          aria-label="Email name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight text-stone-900 outline-none hover:border-stone-300 focus:border-violet-500 focus:bg-white"
          value={email.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <Badge tone={sent ? "emerald" : "stone"}>{sent ? `Sent ${fmtDateTime(email.sentAt!)}` : "Draft"}</Badge>
        <Button onClick={clone}>
          <Copy size={15} />
          Clone
        </Button>
        {!sent && (
          <Button variant="primary" disabled={!email.subject.trim() || recipients.length === 0} onClick={() => setConfirm(true)}>
            <SendIcon size={15} />
            Review and send
          </Button>
        )}
      </div>

      {sent ? (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "performance", label: "Performance" },
              { value: "content", label: "Content" },
            ]}
          />
          {tab === "content" ? (
            <Card className="mt-4">
              <Preview email={email} db={db} />
            </Card>
          ) : (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Sent" value={sends.length} hint={segment ? `Segment: ${segment.name}` : "All subscribed contacts"} />
                <Stat label="Delivered" value={pct(delivered, sends.length)} hint={`${delivered} of ${sends.length}`} />
                <Stat label="Open rate" value={pct(opened, delivered)} hint={`${opened} opened`} />
                <Stat label="Click rate" value={pct(clicked, delivered)} hint={`${clicked} clicked`} />
              </div>
              <Card title="Recipients" className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Contact</th>
                      <th className="px-4 py-2.5 font-medium">Delivered</th>
                      <th className="px-4 py-2.5 font-medium">Opened</th>
                      <th className="px-4 py-2.5 font-medium">Clicked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {sends.map((s) => {
                      const c = db.contacts.find((x) => x.id === s.contactId);
                      if (!c) return null;
                      return (
                        <tr key={s.id} className="hover:bg-stone-50">
                          <td className="px-4 py-2">
                            <Link href={`/contacts/${c.id}`} className="font-medium text-violet-700 hover:underline">
                              {displayName("contacts", c)}
                            </Link>
                            <span className="ml-2 text-xs text-stone-500">{c.email}</span>
                            {s.error && <span className="ml-2 text-xs text-rose-600">{s.error}</span>}
                          </td>
                          <td className="px-4 py-2">
                            <Mark on={s.delivered} />
                          </td>
                          <td className="px-4 py-2">
                            <Mark on={s.opened} />
                          </td>
                          <td className="px-4 py-2">
                            <Mark on={s.clicked} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
          <Card title="Content">
            <div className="space-y-3 p-4">
              <Field label="Subject line">
                <input className={inputCls} value={email.subject} onChange={(e) => set({ subject: e.target.value })} />
              </Field>
              <Field label="Preview text">
                <input className={inputCls} value={email.previewText} onChange={(e) => set({ previewText: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From name">
                  <input className={inputCls} value={email.fromName} onChange={(e) => set({ fromName: e.target.value })} />
                </Field>
                <Field label="Reply-to address">
                  <input className={inputCls} value={email.fromEmail} onChange={(e) => set({ fromEmail: e.target.value })} />
                </Field>
              </div>
              <Field label="Body">
                <textarea rows={9} className={inputCls} value={email.body} onChange={(e) => set({ body: e.target.value })} />
              </Field>
              <p className="text-xs text-stone-500">
                Personalise with <code className="rounded bg-stone-100 px-1">{"{{firstName}}"}</code>, <code className="rounded bg-stone-100 px-1">{"{{lastName}}"}</code> or{" "}
                <code className="rounded bg-stone-100 px-1">{"{{company}}"}</code>.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Button label (optional)">
                  <input className={inputCls} value={email.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} />
                </Field>
                <Field label="Button link">
                  <input className={inputCls} value={email.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} />
                </Field>
              </div>
              <Field label="Send to">
                <select className={inputCls} value={email.segmentId ?? ""} onChange={(e) => set({ segmentId: e.target.value || null })}>
                  <option value="">All subscribed contacts</option>
                  {db.segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="text-sm text-stone-700">
                <span className="font-semibold tabular-nums">{recipients.length}</span> subscribed contact{recipients.length === 1 ? "" : "s"} will receive this email.
              </p>
            </div>
          </Card>
          <Card title="Preview">
            <Preview email={email} db={db} />
          </Card>
        </div>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Send this email?"
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={sending || mail.driver === "none"}
              onClick={async () => {
                setSending(true);
                setSendError("");
                try {
                  await api(`emails/${id}/send`, {});
                  setConfirm(false);
                } catch (err) {
                  setSendError(err instanceof Error ? err.message : "Sending failed.");
                } finally {
                  setSending(false);
                }
              }}
            >
              {sending ? "Sending…" : `Send to ${recipients.length} contact${recipients.length === 1 ? "" : "s"}`}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-700">
          “{email.subject}” will go to <strong>{recipients.length}</strong> subscribed contact{recipients.length === 1 ? "" : "s"}
          {segment ? ` in “${segment.name}”` : ""}.
        </p>
        {mail.driver === "none" ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">Email sending is not set up on this deployment. Add RESEND_API_KEY (or SMTP settings) to the environment variables and redeploy.</p>
        ) : mail.driver === "outbox" ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Development mode: no mail provider is configured, so each message is saved as a file in data/outbox instead of being delivered.</p>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            These are real emails, sent from {mail.from}. Opens and clicks are tracked, and every message carries an unsubscribe link.
          </p>
        )}
        {sendError && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {sendError}
          </p>
        )}
      </Modal>
    </div>
  );
}
