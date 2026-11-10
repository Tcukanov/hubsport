/* Pure functions that change the database object.

   The browser and the server both run the same operation ("op") with the same
   metadata (id seed, timestamp, acting user), so they end up with identical
   results: the browser applies it instantly, the server applies it for real. */
import { DEAL_STAGES, LIFECYCLE, optionLabel } from "./config";
import { segmentContacts } from "./segments";
import type { Activity, AnyRec, CollectionName, Contact, DB, Patch } from "./types";

const PREFIX: Record<CollectionName, string> = {
  users: "u",
  contacts: "c",
  companies: "co",
  deals: "d",
  tasks: "t",
  activities: "a",
  segments: "s",
  forms: "f",
  submissions: "sub",
  emails: "e",
  sends: "sd",
  workflows: "w",
  workflowRuns: "wr",
  prospects: "p",
};

export interface Meta {
  seed: string;
  now: string;
  userId: string | null;
}

export function randomSeed() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function newMeta(userId: string | null): Meta {
  return { seed: randomSeed(), now: new Date().toISOString(), userId };
}

/** Something that happened which an automation workflow may react to. */
export interface CrmEvent {
  type: "contact_created" | "form_submitted" | "lifecycle_changed" | "deal_created" | "deal_stage_changed";
  contactId?: string | null;
  dealId?: string | null;
  value?: string;
}

let ctx: Meta & { n: number; events: CrmEvent[] } = { ...newMeta(null), n: 0, events: [] };
const emit = (e: CrmEvent) => ctx.events.push(e);

/** Run `fn` with ids, timestamps and the acting user taken from `meta`. */
export function withMeta<T>(meta: Meta, fn: () => T, events: CrmEvent[] = []): T {
  const prev = ctx;
  ctx = { ...meta, n: 0, events };
  try {
    return fn();
  } finally {
    ctx = prev;
  }
}

export function newId(c: CollectionName) {
  return `${PREFIX[c]}_${ctx.seed}${(ctx.n++).toString(36)}`;
}

const nowIso = () => ctx.now;

export function logActivity(db: DB, a: Partial<Activity> & { type: string; body: string }) {
  const rec: Activity = { id: newId("activities"), contactId: null, companyId: null, dealId: null, userId: ctx.userId, createdAt: nowIso(), ...a };
  db.activities.unshift(rec);
  return rec;
}

export function createRecord(db: DB, c: CollectionName, data: Patch): AnyRec {
  const now = nowIso();
  const rec: AnyRec = { ...data, id: newId(c), createdAt: now, updatedAt: now };
  (db[c] as AnyRec[]).unshift(rec);
  if (c === "contacts") {
    logActivity(db, { type: "created", body: "Contact created", contactId: rec.id, companyId: rec.companyId ?? null });
    emit({ type: "contact_created", contactId: rec.id });
  }
  if (c === "companies") logActivity(db, { type: "created", body: "Company created", companyId: rec.id });
  if (c === "deals") {
    logActivity(db, { type: "created", body: `Deal created in ${optionLabel(DEAL_STAGES, rec.stage)}`, dealId: rec.id, companyId: rec.companyId ?? null });
    emit({ type: "deal_created", dealId: rec.id, value: rec.stage });
  }
  return rec;
}

export function updateRecord(db: DB, c: CollectionName, id: string, patch: Patch) {
  const rec = (db[c] as AnyRec[]).find((r) => r.id === id);
  if (!rec) return null;
  const before = { ...rec };
  Object.assign(rec, patch, { id, updatedAt: nowIso() });
  if (c === "deals" && patch.stage && patch.stage !== before.stage) {
    logActivity(db, {
      type: "stage_change",
      body: `Deal stage moved from ${optionLabel(DEAL_STAGES, before.stage)} to ${optionLabel(DEAL_STAGES, patch.stage)}`,
      dealId: id,
      companyId: rec.companyId ?? null,
    });
    emit({ type: "deal_stage_changed", dealId: id, value: patch.stage });
  }
  if (c === "contacts" && patch.lifecycleStage && patch.lifecycleStage !== before.lifecycleStage) {
    logActivity(db, {
      type: "stage_change",
      body: `Lifecycle stage changed from ${optionLabel(LIFECYCLE, before.lifecycleStage)} to ${optionLabel(LIFECYCLE, patch.lifecycleStage)}`,
      contactId: id,
      companyId: rec.companyId ?? null,
    });
    emit({ type: "lifecycle_changed", contactId: id, value: patch.lifecycleStage });
  }
  if (c === "tasks" && patch.status && patch.status !== before.status) {
    rec.completedAt = patch.status === "done" ? nowIso() : null;
    if (patch.status === "done")
      logActivity(db, { type: "task", body: `Task completed: ${rec.title}`, contactId: rec.contactId, companyId: rec.companyId, dealId: rec.dealId });
  }
  return rec;
}

export function deleteRecord(db: DB, c: CollectionName, id: string) {
  (db as unknown as Record<string, AnyRec[]>)[c] = (db[c] as AnyRec[]).filter((r) => r.id !== id);
  if (c === "contacts") {
    db.deals.forEach((d) => (d.contactIds = d.contactIds.filter((x) => x !== id)));
    db.activities = db.activities.filter((a) => a.contactId !== id);
    db.tasks = db.tasks.filter((t) => t.contactId !== id);
    db.sends = db.sends.filter((s) => s.contactId !== id);
    db.prospects = db.prospects.filter((p) => p.contactId !== id);
    db.submissions.forEach((s) => s.contactId === id && (s.contactId = null));
  }
  if (c === "companies") {
    db.contacts.forEach((x) => x.companyId === id && (x.companyId = null));
    db.deals.forEach((x) => x.companyId === id && (x.companyId = null));
    db.tasks.forEach((x) => x.companyId === id && (x.companyId = null));
    db.activities = db.activities.filter((a) => !(a.companyId === id && !a.contactId && !a.dealId));
    db.activities.forEach((a) => a.companyId === id && (a.companyId = null));
  }
  if (c === "deals") {
    db.activities = db.activities.filter((a) => a.dealId !== id);
    db.tasks.forEach((x) => x.dealId === id && (x.dealId = null));
  }
  if (c === "forms") db.submissions = db.submissions.filter((s) => s.formId !== id);
  if (c === "emails") db.sends = db.sends.filter((s) => s.emailId !== id);
  if (c === "workflows") db.workflowRuns = db.workflowRuns.filter((r) => r.workflowId !== id);
  if (c === "segments") db.emails.forEach((e) => e.segmentId === id && e.status === "draft" && (e.segmentId = null));
}

/* ---- Operations sent from the browser to the server ---- */

/** Collections the browser may change directly. Users, submissions and sends are server-only. */
export const WRITABLE: CollectionName[] = ["contacts", "companies", "deals", "tasks", "activities", "segments", "forms", "emails", "workflows", "prospects"];

/** Activity types a person can log by hand. System events are written by the server. */
const LOGGABLE = ["note", "call", "meeting"];

export type Op =
  | { t: "create"; c: CollectionName; data: Patch }
  | { t: "update"; c: CollectionName; id: string; patch: Patch }
  | { t: "remove"; c: CollectionName; ids: string[] }
  | { t: "log"; activity: Partial<Activity> & { type: string; body: string } };

export function applyOp(db: DB, op: Op, meta: Meta, events: CrmEvent[] = []): AnyRec | null {
  return withMeta(
    meta,
    () => {
    if (op.t === "log") {
      if (!LOGGABLE.includes(op.activity.type)) throw new Error("This activity type cannot be logged by hand.");
      const { type, subject, body, contactId = null, companyId = null, dealId = null } = op.activity;
      return logActivity(db, { type, subject, body, contactId, companyId, dealId });
    }
    if (!WRITABLE.includes(op.c)) throw new Error(`"${op.c}" cannot be changed directly.`);
    if (op.t === "create") {
      const data = { ...op.data };
      // A browser can never mark an email as sent: only the send endpoint does that.
      if (op.c === "emails") Object.assign(data, { status: "draft", sentAt: null });
      if (op.c === "prospects") throw new Error("Prospects are created by the prospecting agent.");
      return createRecord(db, op.c, data);
    }
    if (op.t === "update") {
      const patch = { ...op.patch };
      if (op.c === "emails") {
        delete patch.status;
        delete patch.sentAt;
      }
      // A draft can be edited or dismissed here, but only the send endpoint marks it sent.
      if (op.c === "prospects") {
        delete patch.sentAt;
        if (patch.status === "sent") delete patch.status;
      }
      return updateRecord(db, op.c, op.id, patch);
    }
    op.ids.forEach((id) => deleteRecord(db, op.c, id));
    return null;
    },
    events,
  );
}

/** A public form was submitted: create or update the contact and record it. */
export function submitForm(db: DB, formId: string, values: Record<string, string>) {
  const form = db.forms.find((f) => f.id === formId);
  if (!form) return null;
  const email = (values.email ?? "").trim().toLowerCase();
  const fields: Patch = {};
  for (const key of ["firstName", "lastName", "phone", "jobTitle", "city"]) if (values[key]) fields[key] = values[key].trim();
  let contact = db.contacts.find((c) => c.email.toLowerCase() === email) as Contact | undefined;
  if (contact) {
    Object.assign(contact, fields, { updatedAt: nowIso() });
  } else {
    contact = createRecord(db, "contacts", {
      firstName: "",
      lastName: "",
      phone: "",
      jobTitle: "",
      city: "",
      country: "",
      companyId: null,
      ownerId: null,
      leadStatus: "new",
      ...fields,
      email,
      lifecycleStage: form.lifecycleStage,
      source: "form",
      subscribed: true,
    }) as Contact;
  }
  db.submissions.unshift({ id: newId("submissions"), formId, contactId: contact.id, values, createdAt: nowIso() });
  logActivity(db, {
    type: "form_submission",
    body: `Submitted the form "${form.name}"${values.message ? `\n\n"${values.message}"` : ""}`,
    contactId: contact.id,
    companyId: contact.companyId,
    userId: null,
  });
  emit({ type: "form_submitted", contactId: contact.id, value: formId });
  return contact;
}

export function emailRecipients(db: DB, segmentId: string | null) {
  const segment = db.segments.find((s) => s.id === segmentId);
  const pool = segment ? segmentContacts(segment, db.contacts) : db.contacts;
  return pool.filter((c) => c.subscribed && c.email);
}
