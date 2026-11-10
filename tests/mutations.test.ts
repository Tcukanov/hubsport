import { beforeEach, describe, expect, it } from "vitest";
import { applyOp, bookMeeting, receiveMessage, stripQuotedReply, submitForm, withMeta, type CrmEvent, type Meta, type Op } from "@/lib/mutations";
import { buildSeed } from "@/lib/seed";
import type { DB } from "@/lib/types";

const me = { id: "u_me", name: "Test Admin", email: "admin@test.example", color: "#000" };
const meta = (seed = "s1", userId: string | null = me.id): Meta => ({ seed, now: "2026-11-10T12:00:00.000Z", userId });

let db: DB;
beforeEach(() => {
  db = buildSeed(me);
});

describe("operations are deterministic", () => {
  it("gives the browser and the server identical results for the same operation", () => {
    const browser = structuredClone(db);
    const server = structuredClone(db);
    const op: Op = { t: "create", c: "contacts", data: { firstName: "Ada", lastName: "Byron", email: "ada@test.example", companyId: null, lifecycleStage: "lead" } };
    const a = applyOp(browser, op, meta());
    const b = applyOp(server, op, meta());
    expect(a).toEqual(b);
    expect(browser).toEqual(server);
    expect(a!.id).toBe("c_s10");
  });
});

describe("what the browser may and may not change", () => {
  it("refuses to touch users, submissions and sends", () => {
    for (const c of ["users", "submissions", "sends"] as const) expect(() => applyOp(db, { t: "remove", c, ids: ["x"] }, meta())).toThrow(/cannot be changed/);
  });

  it("never lets an email be marked as sent from the browser", () => {
    const draft = db.emails.find((e) => e.status === "draft")!;
    applyOp(db, { t: "update", c: "emails", id: draft.id, patch: { status: "sent", sentAt: "2026-01-01", subject: "New subject" } }, meta());
    expect(draft.status).toBe("draft");
    expect(draft.sentAt).toBeNull();
    expect(draft.subject).toBe("New subject");
    const created = applyOp(db, { t: "create", c: "emails", data: { name: "x", status: "sent" } }, meta("s2"))!;
    expect(created.status).toBe("draft");
  });

  it("only allows internal notes as browser-created messages", () => {
    const conv = db.conversations[0];
    const msg = applyOp(db, { t: "create", c: "messages", data: { conversationId: conv.id, body: "hi", direction: "out" } }, meta())!;
    expect(msg.direction).toBe("note");
    expect(msg.userId).toBe(me.id);
    expect(() => applyOp(db, { t: "create", c: "messages", data: { conversationId: "nope", body: "x" } }, meta("s2"))).toThrow(/not found/);
    expect(() => applyOp(db, { t: "create", c: "conversations", data: {} }, meta("s3"))).toThrow();
  });

  it("lets people edit only their own profile, and never the booking link", () => {
    const slug = db.profiles[0].slug;
    applyOp(db, { t: "update", c: "profiles", id: me.id, patch: { phone: "+12125550123", slug: "hijack" } }, meta());
    expect(db.profiles[0].phone).toBe("+12125550123");
    expect(db.profiles[0].slug).toBe(slug);
    expect(() => applyOp(db, { t: "update", c: "profiles", id: me.id, patch: { phone: "1" } }, meta("s2", "u_someone_else"))).toThrow(/own settings/);
    expect(() => applyOp(db, { t: "remove", c: "profiles", ids: [me.id] }, meta("s3"))).toThrow();
  });

  it("only allows manual activity types to be logged by hand", () => {
    expect(() => applyOp(db, { t: "log", activity: { type: "marketing_email", body: "fake" } }, meta())).toThrow();
    const note = applyOp(db, { t: "log", activity: { type: "note", body: "real", contactId: "c_1" } }, meta("s2"))!;
    expect(note.userId).toBe(me.id);
  });
});

describe("records", () => {
  it("logs a deal stage change and announces it to automation", () => {
    const deal = db.deals.find((d) => d.stage === "lead_in")!;
    const events: CrmEvent[] = [];
    applyOp(db, { t: "update", c: "deals", id: deal.id, patch: { stage: "won" } }, meta(), events);
    expect(deal.stage).toBe("won");
    expect(db.activities[0]).toMatchObject({ type: "stage_change", dealId: deal.id, body: "Deal stage moved from Lead in to Closed won" });
    expect(events).toEqual([{ type: "deal_stage_changed", dealId: deal.id, value: "won" }]);
  });

  it("does not log anything when the stage is set to its current value", () => {
    const deal = db.deals[0];
    const before = db.activities.length;
    applyOp(db, { t: "update", c: "deals", id: deal.id, patch: { stage: deal.stage } }, meta());
    expect(db.activities.length).toBe(before);
  });

  it("stamps a ticket as closed and clears the stamp when reopened", () => {
    const ticket = db.tickets.find((t) => t.status === "new")!;
    applyOp(db, { t: "update", c: "tickets", id: ticket.id, patch: { status: "closed" } }, meta());
    expect(ticket.closedAt).toBe("2026-11-10T12:00:00.000Z");
    applyOp(db, { t: "update", c: "tickets", id: ticket.id, patch: { status: "new" } }, meta("s2"));
    expect(ticket.closedAt).toBeNull();
  });

  it("completing a task records when, and reopening clears it", () => {
    const task = db.tasks.find((t) => t.status === "open")!;
    applyOp(db, { t: "update", c: "tasks", id: task.id, patch: { status: "done" } }, meta());
    expect(task.completedAt).toBeTruthy();
    applyOp(db, { t: "update", c: "tasks", id: task.id, patch: { status: "open" } }, meta("s2"));
    expect(task.completedAt).toBeNull();
  });

  it("cleans up everything attached to a deleted contact", () => {
    const conv = db.conversations[0];
    const id = conv.contactId!;
    applyOp(db, { t: "remove", c: "contacts", ids: [id] }, meta());
    expect(db.contacts.some((c) => c.id === id)).toBe(false);
    expect(db.activities.some((a) => a.contactId === id)).toBe(false);
    expect(db.tasks.some((t) => t.contactId === id)).toBe(false);
    expect(db.deals.some((d) => d.contactIds.includes(id))).toBe(false);
    expect(db.conversations.some((c) => c.contactId === id)).toBe(false);
    expect(db.messages.some((m) => m.conversationId === conv.id)).toBe(false);
    expect(db.tickets.some((t) => t.contactId === id)).toBe(false);
  });

  it("unlinks, rather than deletes, the contacts of a deleted company", () => {
    const company = db.companies[0];
    const members = db.contacts.filter((c) => c.companyId === company.id).map((c) => c.id);
    expect(members.length).toBeGreaterThan(0);
    applyOp(db, { t: "remove", c: "companies", ids: [company.id] }, meta());
    for (const id of members) expect(db.contacts.find((c) => c.id === id)?.companyId).toBeNull();
  });
});

describe("form submissions", () => {
  const submit = (values: Record<string, string>, events: CrmEvent[] = []) => withMeta(meta(), () => submitForm(db, "f_2", values), events);

  it("creates a new contact with the form's lifecycle stage", () => {
    const events: CrmEvent[] = [];
    const contact = submit({ firstName: "New", lastName: "Person", email: "New.Person@Test.example" }, events)!;
    expect(contact).toMatchObject({ email: "new.person@test.example", lifecycleStage: "lead", source: "form" });
    expect(db.submissions[0]).toMatchObject({ formId: "f_2", contactId: contact.id });
    expect(events.map((e) => e.type)).toEqual(["contact_created", "form_submitted"]);
  });

  it("updates an existing contact instead of creating a duplicate", () => {
    const existing = db.contacts[0];
    const count = db.contacts.length;
    const contact = submit({ firstName: "Renamed", email: existing.email.toUpperCase() })!;
    expect(db.contacts.length).toBe(count);
    expect(contact.id).toBe(existing.id);
    expect(contact.firstName).toBe("Renamed");
  });

  it("puts a message from the form into the shared inbox", () => {
    const before = db.conversations.length;
    submit({ firstName: "Q", email: "q@test.example", message: "Please call me" });
    expect(db.conversations.length).toBe(before + 1);
    expect(db.conversations[0]).toMatchObject({ channel: "form", unread: true, status: "open" });
    expect(db.messages.at(-1)).toMatchObject({ direction: "in", body: "Please call me" });
  });
});

describe("shared inbox threading", () => {
  const receive = (subject: string, body = "hello", seed = "r1") => withMeta(meta(seed, null), () => receiveMessage(db, { email: "writer@test.example", name: "Wendy Writer", subject, body, channel: "email" }));

  it("creates the contact and a new conversation for an unknown sender", () => {
    const conv = receive("Pricing");
    const contact = db.contacts.find((c) => c.id === conv.contactId)!;
    expect(contact).toMatchObject({ firstName: "Wendy", lastName: "Writer", email: "writer@test.example", subscribed: false });
    expect(conv).toMatchObject({ subject: "Pricing", unread: true, status: "open" });
  });

  it("threads a reply with the same subject into the open conversation", () => {
    const first = receive("Pricing");
    const second = receive("RE: Re: Pricing", "more", "r2");
    expect(second.id).toBe(first.id);
    expect(db.messages.filter((m) => m.conversationId === first.id)).toHaveLength(2);
  });

  it("uses the [#id] tag to find a closed conversation and reopens it", () => {
    const first = receive("Pricing");
    first.status = "closed";
    first.unread = false;
    const again = receive(`Re: something else entirely [#${first.id}]`, "thanks", "r2");
    expect(again.id).toBe(first.id);
    expect(again).toMatchObject({ status: "open", unread: true });
  });

  it("ignores a tag that belongs to someone else's conversation", () => {
    const other = db.conversations[0];
    const conv = receive(`Hello [#${other.id}]`);
    expect(conv.id).not.toBe(other.id);
    expect(conv.subject).toBe("Hello");
  });

  it("strips quoted earlier messages from a reply", () => {
    expect(stripQuotedReply("Sounds good.\n\nOn Mon, Nov 9, 2026 at 3:00 PM Alex <a@b.c> wrote:\n> earlier text\n> more")).toBe("Sounds good.");
    expect(stripQuotedReply("Just a line")).toBe("Just a line");
    expect(stripQuotedReply("> only quoted")).toBe("> only quoted");
  });
});

describe("meeting bookings", () => {
  it("creates the booking, the contact and a timeline entry", () => {
    const profile = db.profiles[0];
    const booking = withMeta(meta("b1", null), () => bookMeeting(db, { profile, start: "2026-11-12T15:00:00.000Z", guestName: "Gina Guest", guestEmail: "Gina@Guest.example", notes: "" }));
    expect(booking).toMatchObject({ userId: me.id, status: "scheduled", end: "2026-11-12T15:30:00.000Z", guestEmail: "gina@guest.example" });
    expect(db.activities[0]).toMatchObject({ type: "meeting", contactId: booking.contactId, userId: me.id });
  });

  it("only lets a booking's status be changed from the browser", () => {
    const profile = db.profiles[0];
    const booking = withMeta(meta("b1", null), () => bookMeeting(db, { profile, start: "2026-11-12T15:00:00.000Z", guestName: "G", guestEmail: "g@test.example", notes: "" }));
    applyOp(db, { t: "update", c: "bookings", id: booking.id, patch: { status: "cancelled", start: "2030-01-01T00:00:00.000Z" } }, meta("b2"));
    expect(db.bookings[0]).toMatchObject({ status: "cancelled", start: "2026-11-12T15:00:00.000Z" });
  });
});
