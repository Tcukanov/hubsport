/* The whole JSON API lives in this one file, as a list of small handlers.
   Each handler is named after the request it answers, e.g. "POST auth/login". */
import { applyOp, emailRecipients, logActivity, newMeta, randomSeed, submitForm, withMeta, type CrmEvent, type Meta, type Op } from "@/lib/mutations";
import { buildSeed } from "@/lib/seed";
import { HttpError, colorFor, handle, isEmail, json, originOf, publicUser, readBody, requireAdmin, requireUser, str, syncUsers } from "@/lib/server/api";
import { checkPassword, currentUser, endSession, hashPassword, readToken, shortSig, signToken, startSession } from "@/lib/server/auth";
import { mailDriver, mailFrom, marketingEmail, plainEmailHtml, sendMail, type MailResult } from "@/lib/server/mailer";
import { aiConfigured, draftOutreach } from "@/lib/server/prospecting";
import { getStore, type AppUser } from "@/lib/server/store";
import { runWorkflows, type PendingEmail } from "@/lib/server/workflows";
import type { DB, Prospect, Send } from "@/lib/types";

export const maxDuration = 60;

const MAX_RECIPIENTS = 100;

/** Older saved data may lack collections added later. */
function normalize(db: DB) {
  db.workflows ??= [];
  db.workflowRuns ??= [];
  db.prospects ??= [];
  return db;
}

/** Change the data, then let automation workflows react to what happened. */
async function change<T>(meta: Meta, fn: (db: DB, events: CrmEvent[]) => T) {
  const store = getStore();
  const out = await store.updateDB((db) => {
    normalize(db);
    const events: CrmEvent[] = [];
    const lastRun = db.workflowRuns[0]?.id;
    const result = fn(db, events);
    const emails = runWorkflows(db, events, meta);
    return { result, emails, automated: db.workflowRuns[0]?.id !== lastRun };
  });
  if (out.emails.length) await deliverWorkflowEmails(out.emails, meta);
  return out;
}

async function deliverWorkflowEmails(emails: PendingEmail[], meta: Meta) {
  const results: (PendingEmail & MailResult)[] = [];
  for (const e of emails) {
    const r = await sendMail({ to: e.to, subject: e.subject, html: plainEmailHtml(e.body), text: e.body, fromName: "Pipeline" });
    results.push({ ...e, ...r });
  }
  await getStore().updateDB((db) =>
    withMeta({ ...meta, seed: `${meta.seed}m`, userId: null }, () => {
      for (const r of results) {
        const companyId = db.contacts.find((c) => c.id === r.contactId)?.companyId ?? null;
        logActivity(db, {
          type: "email",
          subject: r.ok ? `${r.subject} (automated)` : `Not sent: ${r.subject}`,
          body: r.ok ? `${r.body}\n\n— sent by the workflow "${r.workflow}"` : `The workflow "${r.workflow}" could not send this email: ${r.error}`,
          contactId: r.contactId,
          companyId,
        });
      }
    }),
  );
}

async function loadDB() {
  const db = await getStore().readDB();
  if (!db) throw new HttpError(409, "The workspace has not been created yet.");
  return normalize(db);
}

function newUser(name: string, email: string, password: string, role: AppUser["role"], count: number): AppUser {
  return { id: `u_${randomSeed()}`, name, email, passwordHash: hashPassword(password), role, color: colorFor(count), createdAt: new Date().toISOString() };
}

function checkNewAccount(name: string, password: string) {
  if (!name) throw new HttpError(400, "Please enter your name.");
  if (password.length < 8) throw new HttpError(400, "The password needs at least 8 characters.");
}

type Handler = (req: Request, id: string) => Promise<Response>;

const routes: Record<string, Handler> = {
  /* ---------- Sign-in ---------- */

  "GET auth/status": async () => {
    const users = await getStore().listUsers();
    return json({ hasUsers: users.length > 0, signedIn: !!(await currentUser()) });
  },

  // The very first person to sign up creates the workspace and becomes its admin.
  // After that, new people can only join through an invitation.
  "POST auth/signup": async (req) => {
    const store = getStore();
    if ((await store.listUsers()).length) throw new HttpError(403, "Sign-up is closed. Ask an admin of this workspace for an invitation.");
    const body = await readBody(req);
    const name = str(body.name, 80);
    const email = str(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!isEmail(email)) throw new HttpError(400, "Please enter a valid email address.");
    checkNewAccount(name, password);
    const user = newUser(name, email, password, "admin", 0);
    await store.saveUser(user);
    await store.writeDB(buildSeed(publicUser(user)));
    await startSession(user.id);
    return json({ ok: true });
  },

  "POST auth/login": async (req) => {
    const body = await readBody(req);
    const email = str(body.email, 200).toLowerCase();
    const user = (await getStore().listUsers()).find((u) => u.email === email);
    if (!user || !checkPassword(typeof body.password === "string" ? body.password : "", user.passwordHash)) throw new HttpError(401, "Wrong email or password.");
    await startSession(user.id);
    return json({ ok: true });
  },

  "POST auth/logout": async () => {
    await endSession();
    return json({ ok: true });
  },

  /* ---------- CRM data ---------- */

  "GET workspace": async () => {
    const user = await requireUser();
    const store = getStore();
    return json({ db: await loadDB(), meId: user.id, storage: store.kind, mail: { driver: mailDriver(), from: mailFrom() }, ai: aiConfigured() });
  },

  // Every edit made in the browser arrives here as one operation.
  "POST ops": async (req) => {
    const user = await requireUser();
    const body = await readBody(req);
    const sent = (body.meta ?? {}) as Partial<Meta>;
    const seed = str(sent.seed, 40);
    if (!/^[a-z0-9]+$/.test(seed)) throw new HttpError(400, "Bad operation.");
    // Use the browser's timestamp (so both sides agree) unless its clock is far off.
    const theirs = Date.parse(str(sent.now, 40));
    const inSync = Number.isFinite(theirs) && Math.abs(theirs - Date.now()) < 10 * 60_000;
    const meta: Meta = { seed, now: inSync ? new Date(theirs).toISOString() : new Date().toISOString(), userId: user.id };
    let out;
    try {
      out = await change(meta, (db, events) => applyOp(db, body.op as Op, meta, events));
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, err instanceof Error ? err.message : "The change could not be applied.");
    }
    return json({ ok: true, refresh: out.automated || !inSync });
  },

  "POST reset": async () => {
    const admin = await requireAdmin();
    await getStore().writeDB(buildSeed(publicUser(admin)));
    await syncUsers();
    return json({ ok: true });
  },

  /* ---------- Email ---------- */

  // Send a marketing email to every subscribed contact in its segment.
  "POST emails/send": async (req, id) => {
    const user = await requireUser();
    if (mailDriver() === "none") throw new HttpError(400, "Email sending is not set up yet. Add RESEND_API_KEY or SMTP settings to the environment.");
    const db = await loadDB();
    const email = db.emails.find((e) => e.id === id);
    if (!email) throw new HttpError(404, "Email not found.");
    if (email.status === "sent") throw new HttpError(400, "This email was already sent.");
    if (!email.subject.trim()) throw new HttpError(400, "Add a subject line first.");
    const recipients = emailRecipients(db, email.segmentId);
    if (!recipients.length) throw new HttpError(400, "No subscribed contacts match this segment.");
    if (recipients.length > MAX_RECIPIENTS) throw new HttpError(400, `This demo sends to at most ${MAX_RECIPIENTS} contacts at a time. Narrow the segment.`);

    const origin = originOf(req);
    const meta = newMeta(user.id);
    const sends: Send[] = [];
    for (const [i, contact] of recipients.entries()) {
      const sendId = `sd_${meta.seed}x${i.toString(36)}`;
      const company = db.companies.find((c) => c.id === contact.companyId);
      const mail = marketingEmail(email, contact, company, {
        open: `${origin}/t/o/${sendId}`,
        click: `${origin}/t/c/${sendId}`,
        unsubscribe: `${origin}/u/${contact.id}/${shortSig(contact.id)}`,
      });
      const r = await sendMail({ to: contact.email, ...mail, fromName: email.fromName || user.name, replyTo: isEmail(email.fromEmail) ? email.fromEmail : undefined });
      sends.push({ id: sendId, emailId: id, contactId: contact.id, delivered: r.ok, opened: false, clicked: false, error: r.error, createdAt: meta.now });
    }

    await getStore().updateDB((d) =>
      withMeta(meta, () => {
        const target = normalize(d).emails.find((e) => e.id === id);
        if (!target || target.status === "sent") return;
        d.sends.push(...sends);
        for (const s of sends.filter((x) => x.delivered)) {
          const companyId = d.contacts.find((c) => c.id === s.contactId)?.companyId ?? null;
          logActivity(d, { type: "marketing_email", subject: target.name, body: `Was sent the marketing email "${target.name}"`, contactId: s.contactId, companyId, userId: null });
        }
        Object.assign(target, { status: "sent", sentAt: meta.now, updatedAt: meta.now });
      }),
    );
    return json({ ok: true, sent: sends.filter((s) => s.delivered).length, failed: sends.filter((s) => !s.delivered).length });
  },

  // Send a one-to-one email from a record page and log it on the timeline.
  "POST send-email": async (req) => {
    const user = await requireUser();
    if (mailDriver() === "none") throw new HttpError(400, "Email sending is not set up yet. Add RESEND_API_KEY or SMTP settings to the environment.");
    const body = await readBody(req);
    const subject = str(body.subject, 200);
    const text = str(body.body, 10_000);
    if (!subject || !text) throw new HttpError(400, "Write a subject and a message first.");
    const db = await loadDB();
    const contact = db.contacts.find((c) => c.id === body.contactId);
    if (!contact || !isEmail(contact.email)) throw new HttpError(400, "This contact has no valid email address.");
    const r = await sendMail({ to: contact.email, subject, html: plainEmailHtml(text), text, fromName: user.name, replyTo: user.email });
    if (!r.ok) throw new HttpError(502, `The email could not be sent: ${r.error}`);
    const dealId = db.deals.some((d) => d.id === body.dealId) ? (body.dealId as string) : null;
    await getStore().updateDB((d) => withMeta(newMeta(user.id), () => logActivity(d, { type: "email", subject, body: text, contactId: contact.id, companyId: contact.companyId, dealId })));
    return json({ ok: true });
  },

  /* ---------- Public forms (no sign-in) ---------- */

  "GET public/forms": async (_req, id) => {
    const form = (await getStore().readDB())?.forms.find((f) => f.id === id);
    if (!form || form.status !== "published") throw new HttpError(404, "This form is not available.");
    return json({ form });
  },

  "POST public/forms": async (req, id) => {
    const body = await readBody(req);
    const form = (await loadDB()).forms.find((f) => f.id === id);
    if (!form || form.status !== "published") throw new HttpError(404, "This form is not available.");
    const raw = (body.values ?? {}) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const field of form.fields) {
      const value = str(raw[field.key], field.type === "textarea" ? 2000 : 200);
      if (field.required && !value) throw new HttpError(400, `"${field.label}" is required.`);
      if (value) values[field.key] = value;
    }
    if (!isEmail(values.email ?? "")) throw new HttpError(400, "Please enter a valid email address.");
    const meta = newMeta(null);
    await change(meta, (db, events) => withMeta(meta, () => submitForm(db, id, values), events));
    return json({ ok: true });
  },

  /* ---------- Users ---------- */

  // Create an invitation link (and email it when sending is set up).
  "POST users": async (req) => {
    const admin = await requireAdmin();
    const body = await readBody(req);
    const email = str(body.email, 200).toLowerCase();
    const role = body.role === "admin" ? "admin" : "member";
    if (!isEmail(email)) throw new HttpError(400, "Please enter a valid email address.");
    if ((await getStore().listUsers()).some((u) => u.email === email)) throw new HttpError(400, "Someone with this email is already in the workspace.");
    const link = `${originOf(req)}/invite/${signToken({ k: "invite", email, role }, 7)}`;
    const text = `${admin.name} invited you to join their Pipeline CRM workspace.\n\nOpen this link to choose a password (valid for 7 days):\n${link}`;
    const emailed = mailDriver() !== "none" && (await sendMail({ to: email, subject: `${admin.name} invited you to Pipeline CRM`, html: plainEmailHtml(text), text, fromName: "Pipeline", replyTo: admin.email })).ok;
    return json({ link, emailed });
  },

  "PATCH users": async (req, id) => {
    await requireAdmin();
    const store = getStore();
    const users = await store.listUsers();
    const target = users.find((u) => u.id === id);
    if (!target) throw new HttpError(404, "User not found.");
    const role = (await readBody(req)).role === "admin" ? "admin" : "member";
    if (target.role === "admin" && role === "member" && users.filter((u) => u.role === "admin").length === 1) throw new HttpError(400, "A workspace needs at least one admin.");
    await store.saveUser({ ...target, role });
    await syncUsers();
    return json({ ok: true });
  },

  "DELETE users": async (_req, id) => {
    const admin = await requireAdmin();
    if (admin.id === id) throw new HttpError(400, "You cannot remove yourself.");
    await getStore().deleteUser(id);
    await syncUsers();
    return json({ ok: true });
  },

  "GET invite": async (_req, token) => {
    const invite = readToken<{ k: string; email: string }>(token);
    if (invite?.k !== "invite") throw new HttpError(404, "This invitation is invalid or has expired.");
    return json({ email: invite.email });
  },

  "POST invite": async (req, token) => {
    const invite = readToken<{ k: string; email: string; role: AppUser["role"] }>(token);
    if (invite?.k !== "invite") throw new HttpError(404, "This invitation is invalid or has expired.");
    const store = getStore();
    const users = await store.listUsers();
    if (users.some((u) => u.email === invite.email)) throw new HttpError(400, "This invitation was already used. Sign in instead.");
    const body = await readBody(req);
    const name = str(body.name, 80);
    const password = typeof body.password === "string" ? body.password : "";
    checkNewAccount(name, password);
    const user = newUser(name, invite.email, password, invite.role === "admin" ? "admin" : "member", users.length);
    await store.saveUser(user);
    await syncUsers();
    await startSession(user.id);
    return json({ ok: true });
  },

  "POST account": async (req) => {
    const user = await requireUser();
    const body = await readBody(req);
    const next = { ...user };
    const name = str(body.name, 80);
    if (name) next.name = name;
    if (typeof body.newPassword === "string" && body.newPassword) {
      if (!checkPassword(typeof body.currentPassword === "string" ? body.currentPassword : "", user.passwordHash)) throw new HttpError(400, "The current password is wrong.");
      if (body.newPassword.length < 8) throw new HttpError(400, "The new password needs at least 8 characters.");
      next.passwordHash = hashPassword(body.newPassword);
    }
    await getStore().saveUser(next);
    await syncUsers();
    return json({ ok: true });
  },

  /* ---------- Prospecting agent ---------- */

  // Research the chosen contacts and draft an outreach email for each.
  "POST prospecting/run": async (req) => {
    const user = await requireUser();
    const body = await readBody(req);
    const ids = Array.isArray(body.contactIds) ? body.contactIds.filter((x): x is string => typeof x === "string").slice(0, 8) : [];
    const db = await loadDB();
    const waiting = new Set(db.prospects.filter((p) => p.status === "draft").map((p) => p.contactId));
    const contacts = db.contacts.filter((c) => ids.includes(c.id) && !waiting.has(c.id) && isEmail(c.email));
    if (!contacts.length) throw new HttpError(400, "Pick at least one contact with an email address that has no draft waiting.");
    const settings = { pitch: str(body.pitch, 2000), tone: str(body.tone, 100), senderName: user.name };
    const drafts = await Promise.all(contacts.map((c) => draftOutreach(db, c, settings)));
    const meta = newMeta(user.id);
    const prospects: Prospect[] = contacts.map((c, i) => ({ id: `p_${meta.seed}${i.toString(36)}`, contactId: c.id, status: "draft", ...drafts[i], createdAt: meta.now, updatedAt: meta.now, sentAt: null }));
    await getStore().updateDB((d) => void normalize(d).prospects.unshift(...prospects));
    return json({ ok: true, created: prospects.length, ai: drafts.filter((d) => d.generatedBy === "ai").length });
  },

  // A person approved a draft: send it and log it on the contact.
  "POST prospecting/send": async (_req, id) => {
    const user = await requireUser();
    if (mailDriver() === "none") throw new HttpError(400, "Email sending is not set up yet. Add RESEND_API_KEY or SMTP settings to the environment.");
    const db = await loadDB();
    const prospect = db.prospects.find((p) => p.id === id);
    const contact = db.contacts.find((c) => c.id === prospect?.contactId);
    if (!prospect || prospect.status !== "draft" || !contact) throw new HttpError(404, "This draft is no longer available.");
    const r = await sendMail({ to: contact.email, subject: prospect.subject, html: plainEmailHtml(prospect.body), text: prospect.body, fromName: user.name, replyTo: user.email });
    if (!r.ok) throw new HttpError(502, `The email could not be sent: ${r.error}`);
    const meta = newMeta(user.id);
    await getStore().updateDB((d) =>
      withMeta(meta, () => {
        const p = normalize(d).prospects.find((x) => x.id === id);
        if (p) Object.assign(p, { status: "sent", sentAt: meta.now, updatedAt: meta.now });
        logActivity(d, { type: "email", subject: prospect.subject, body: prospect.body, contactId: contact.id, companyId: contact.companyId });
      }),
    );
    return json({ ok: true });
  },
};

/** "emails/e_1/send" -> route "emails/send" with id "e_1"; "users/u_1" -> route "users" with id "u_1". */
function match(method: string, path: string[]): [Handler, string] | null {
  const exact = routes[`${method} ${path.join("/")}`];
  if (exact) return [exact, ""];
  if (path.length === 2 && routes[`${method} ${path[0]}`]) return [routes[`${method} ${path[0]}`], path[1]];
  if (path.length === 3) {
    const tail = routes[`${method} ${path[0]}/${path[2]}`];
    if (tail) return [tail, path[1]];
    const head = routes[`${method} ${path[0]}/${path[1]}`];
    if (head) return [head, path[2]];
  }
  return null;
}

async function entry(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const found = match(req.method, path);
  if (!found) return json({ error: "Not found." }, 404);
  return handle(() => found[0](req, found[1]));
}

export { entry as GET, entry as POST, entry as PATCH, entry as DELETE };
