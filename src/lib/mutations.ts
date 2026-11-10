/* Pure functions that change the database object. The data provider clones
   the DB, runs one of these, and saves the result. */
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
};

export const ME = "u_1";

export function newId(c: CollectionName) {
  return `${PREFIX[c]}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const nowIso = () => new Date().toISOString();

export function logActivity(db: DB, a: Partial<Activity> & { type: string; body: string }) {
  const rec: Activity = { id: newId("activities"), contactId: null, companyId: null, dealId: null, userId: ME, createdAt: nowIso(), ...a };
  db.activities.unshift(rec);
  return rec;
}

export function createRecord(db: DB, c: CollectionName, data: Patch): AnyRec {
  const now = nowIso();
  const rec: AnyRec = { ...data, id: newId(c), createdAt: now, updatedAt: now };
  (db[c] as AnyRec[]).unshift(rec);
  if (c === "contacts") logActivity(db, { type: "created", body: "Contact created", contactId: rec.id, companyId: rec.companyId ?? null });
  if (c === "companies") logActivity(db, { type: "created", body: "Company created", companyId: rec.id });
  if (c === "deals")
    logActivity(db, { type: "created", body: `Deal created in ${optionLabel(DEAL_STAGES, rec.stage)}`, dealId: rec.id, companyId: rec.companyId ?? null });
  return rec;
}

export function updateRecord(db: DB, c: CollectionName, id: string, patch: Patch) {
  const rec = (db[c] as AnyRec[]).find((r) => r.id === id);
  if (!rec) return null;
  const before = { ...rec };
  Object.assign(rec, patch, { id, updatedAt: nowIso() });
  if (c === "deals" && patch.stage && patch.stage !== before.stage)
    logActivity(db, {
      type: "stage_change",
      body: `Deal stage moved from ${optionLabel(DEAL_STAGES, before.stage)} to ${optionLabel(DEAL_STAGES, patch.stage)}`,
      dealId: id,
      companyId: rec.companyId ?? null,
    });
  if (c === "contacts" && patch.lifecycleStage && patch.lifecycleStage !== before.lifecycleStage)
    logActivity(db, {
      type: "stage_change",
      body: `Lifecycle stage changed from ${optionLabel(LIFECYCLE, before.lifecycleStage)} to ${optionLabel(LIFECYCLE, patch.lifecycleStage)}`,
      contactId: id,
      companyId: rec.companyId ?? null,
    });
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
  if (c === "segments") db.emails.forEach((e) => e.segmentId === id && e.status === "draft" && (e.segmentId = null));
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
  return contact;
}

export function emailRecipients(db: DB, segmentId: string | null) {
  const segment = db.segments.find((s) => s.id === segmentId);
  const pool = segment ? segmentContacts(segment, db.contacts) : db.contacts;
  return pool.filter((c) => c.subscribed && c.email);
}

/** Simulated send: nothing leaves the app, delivery and engagement are randomised. */
export function sendEmail(db: DB, emailId: string) {
  const email = db.emails.find((e) => e.id === emailId);
  if (!email || email.status === "sent") return 0;
  const at = nowIso();
  const recipients = emailRecipients(db, email.segmentId);
  recipients.forEach((c) => {
    const delivered = Math.random() > 0.03;
    const opened = delivered && Math.random() < 0.46;
    db.sends.push({ id: newId("sends"), emailId, contactId: c.id, delivered, opened, clicked: opened && Math.random() < 0.3, createdAt: at });
    logActivity(db, {
      type: "marketing_email",
      subject: email.name,
      body: `Was sent the marketing email "${email.name}"`,
      contactId: c.id,
      companyId: c.companyId,
      userId: null,
    });
  });
  email.status = "sent";
  email.sentAt = at;
  email.updatedAt = at;
  return recipients.length;
}
