"use client";

import { Copy, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useData } from "@/components/data";
import { Avatar, Badge, Button, Card, Field, Modal, PageHeader, inputCls } from "@/components/ui";

function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await fn();
      if (text) setMessage({ ok: true, text });
      return true;
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, message, run };
}

const Note = ({ m }: { m: { ok: boolean; text: string } | null }) =>
  m && (
    <p role={m.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${m.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
      {m.text}
    </p>
  );

export default function SettingsPage() {
  const { db, me, api, update, mail, ai, storage, inboundUrl, telephony } = useData();
  const profile = db.profiles.find((p) => p.id === me.id);
  const admin = me.role === "admin";
  const people = db.users.filter((u) => !u.demo);
  const demo = db.users.filter((u) => u.demo);

  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "member" });
  const [link, setLink] = useState<{ url: string; emailed: boolean } | null>(null);
  const [name, setName] = useState(me.name);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const users = useAction();
  const inviteAction = useAction();
  const account = useAction();
  const reset = useAction();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Settings" subtitle="Users, your account and how this workspace is connected." />

      <Card
        title={`Users (${people.length})`}
        action={
          admin && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setLink(null);
                setInviting(true);
              }}
            >
              <UserPlus size={14} />
              Invite user
            </Button>
          )
        }
      >
        <ul className="divide-y divide-stone-100">
          {people.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={u.name} color={u.color} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">
                  {u.name}
                  {u.id === me.id && <span className="ml-2 text-xs font-normal text-stone-500">you</span>}
                </p>
                <p className="truncate text-xs text-stone-500">{u.email}</p>
              </div>
              {admin && u.id !== me.id ? (
                <>
                  <select aria-label={`Role for ${u.name}`} className={`${inputCls} !w-auto`} value={u.role} disabled={users.busy} onChange={(e) => users.run(() => api(`users/${u.id}`, { role: e.target.value }, "PATCH").then(() => undefined))}>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                  <button
                    type="button"
                    aria-label={`Remove ${u.name}`}
                    disabled={users.busy}
                    onClick={() => window.confirm(`Remove ${u.name}? Their records become unassigned.`) && users.run(() => api(`users/${u.id}`, {}, "DELETE").then(() => undefined))}
                    className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <Badge tone={u.role === "admin" ? "violet" : "stone"}>{u.role === "admin" ? "Admin" : "Member"}</Badge>
              )}
            </li>
          ))}
        </ul>
        {users.message && (
          <div className="px-4 pb-3">
            <Note m={users.message} />
          </div>
        )}
        {demo.length > 0 && (
          <p className="border-t border-stone-100 px-4 py-3 text-xs text-stone-500">
            The demo data also contains {demo.length} sample teammates ({demo.map((u) => u.name).join(", ")}) who own some records but cannot sign in.
          </p>
        )}
      </Card>

      <Card title="Your account">
        <div className="grid gap-5 p-4 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Name">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email">
              <input className={`${inputCls} bg-stone-50 text-stone-500`} value={me.email} readOnly />
            </Field>
            <Field label="Your phone number (for click-to-call, e.g. +12125550123)">
              <input key={profile?.phone} type="tel" className={inputCls} defaultValue={profile?.phone ?? ""} placeholder="+12125550123" onBlur={(e) => e.target.value !== (profile?.phone ?? "") && update("profiles", me.id, { phone: e.target.value.trim() })} />
            </Field>
            <Button disabled={account.busy || !name.trim() || name === me.name} onClick={() => account.run(() => api("account", { name }).then(() => "Name updated."))}>
              Save name
            </Button>
          </div>
          <div className="space-y-3">
            <Field label="Current password">
              <input type="password" autoComplete="current-password" className={inputCls} value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            </Field>
            <Field label="New password (8+ characters)">
              <input type="password" autoComplete="new-password" className={inputCls} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            </Field>
            <Button
              disabled={account.busy || !pw.currentPassword || pw.newPassword.length < 8}
              onClick={async () => {
                if (await account.run(() => api("account", pw).then(() => "Password changed."))) setPw({ currentPassword: "", newPassword: "" });
              }}
            >
              Change password
            </Button>
          </div>
          <div className="md:col-span-2">
            <Note m={account.message} />
          </div>
        </div>
      </Card>

      <Card title="Connections">
        <dl className="divide-y divide-stone-100 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <dt className="text-stone-600">Database</dt>
            <dd className="flex items-center gap-2 text-stone-900">
              {storage === "postgres" ? "Postgres" : "Local JSON file (data/store.json)"}
              <Badge tone="emerald">Connected</Badge>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <dt className="text-stone-600">Email sending</dt>
            <dd className="flex items-center gap-2 text-stone-900">
              {mail.driver === "resend" && `Resend, from ${mail.from}`}
              {mail.driver === "smtp" && `SMTP, from ${mail.from}`}
              {mail.driver === "outbox" && "Development outbox (files in data/outbox)"}
              {mail.driver === "none" && "Set RESEND_API_KEY or SMTP_HOST / SMTP_USER / SMTP_PASS"}
              <Badge tone={mail.driver === "none" ? "rose" : mail.driver === "outbox" ? "amber" : "emerald"}>{mail.driver === "none" ? "Not set up" : mail.driver === "outbox" ? "Dev only" : "Live"}</Badge>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <dt className="text-stone-600">Phone calling</dt>
            <dd className="flex items-center gap-2 text-stone-900">
              {telephony ? "Twilio click-to-call" : "Uses your own phone app (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM for click-to-call)"}
              <Badge tone={telephony ? "emerald" : "amber"}>{telephony ? "Live" : "Phone link"}</Badge>
            </dd>
          </div>
          {inboundUrl && (
            <div className="space-y-2 px-4 py-3">
              <dt className="text-stone-600">Incoming email (shared inbox)</dt>
              <dd className="space-y-2">
                <input aria-label="Inbound webhook address" readOnly className={`${inputCls} font-mono text-xs`} value={inboundUrl} onFocus={(e) => e.target.select()} />
                <p className="text-xs text-stone-500">
                  To receive replies in the Inbox, set this address as the inbound webhook at your mail provider. It accepts JSON or form posts with the fields from, subject and text. Keep it private: anyone who has it can post messages into the inbox. Optionally set INBOUND_ADDRESS to the
                  mailbox your provider receives on, so replies are addressed there.
                </p>
              </dd>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <dt className="text-stone-600">Prospecting agent</dt>
            <dd className="flex items-center gap-2 text-stone-900">
              {ai ? "Drafts written by Claude" : "Template drafts (set ANTHROPIC_API_KEY for AI drafts)"}
              <Badge tone={ai ? "emerald" : "amber"}>{ai ? "AI on" : "Template"}</Badge>
            </dd>
          </div>
        </dl>
      </Card>

      {admin && (
        <Card title="Demo data">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="max-w-md text-sm text-stone-600">Replace every contact, company, deal, email, form and workflow with the original demo data. Users are kept.</p>
            <Button variant="danger" disabled={reset.busy} onClick={() => window.confirm("Replace all CRM data with the demo data? This cannot be undone.") && reset.run(() => api("reset", {}).then(() => "Demo data restored."))}>
              Reset demo data
            </Button>
            <div className="w-full">
              <Note m={reset.message} />
            </div>
          </div>
        </Card>
      )}

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite a user"
        footer={
          link ? (
            <Button variant="primary" onClick={() => setInviting(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button onClick={() => setInviting(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={inviteAction.busy || !invite.email.includes("@")}
                onClick={() =>
                  inviteAction.run(async () => {
                    const r = await api<{ link: string; emailed: boolean }>("users", invite);
                    setLink({ url: r.link, emailed: r.emailed });
                    setInvite({ email: "", role: "member" });
                  })
                }
              >
                Create invitation
              </Button>
            </>
          )
        }
      >
        {link ? (
          <>
            <p className="text-sm text-stone-700">{link.emailed ? "The invitation was emailed. You can also share this link yourself:" : "Share this link with them. It is valid for 7 days:"}</p>
            <div className="flex gap-2">
              <input aria-label="Invitation link" readOnly className={`${inputCls} font-mono text-xs`} value={link.url} onFocus={(e) => e.target.select()} />
              <Button onClick={() => navigator.clipboard?.writeText(link.url)}>
                <Copy size={14} />
                Copy
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label="Email address">
              <input autoFocus type="email" className={inputCls} value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            </Field>
            <Field label="Role">
              <select className={inputCls} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                <option value="member">Member: works with all CRM records</option>
                <option value="admin">Admin: can also manage users and reset data</option>
              </select>
            </Field>
            <Note m={inviteAction.message} />
          </>
        )}
      </Modal>
    </div>
  );
}
