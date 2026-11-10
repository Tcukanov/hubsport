import { describe, expect, it } from "vitest";
import { availableSlots, icsFor, slugify, zonedToUtc } from "@/lib/booking";
import { buildSeed } from "@/lib/seed";
import { renderTokens, segmentContacts } from "@/lib/segments";
import { runWorkflows } from "@/lib/server/workflows";
import { e164 } from "@/lib/server/telephony";
import type { Booking, Contact, Profile } from "@/lib/types";

const me = { id: "u_me", name: "Test Admin", email: "admin@test.example", color: "#000" };

describe("segments", () => {
  const base = buildSeed(me).contacts[0];
  const people: Contact[] = [
    { ...base, id: "a", firstName: "Ann", email: "ann@hotel.example", lifecycleStage: "customer", subscribed: true, jobTitle: "Events Coordinator", createdAt: new Date(Date.now() - 5 * 864e5).toISOString() },
    { ...base, id: "b", firstName: "Bob", email: "bob@shop.example", lifecycleStage: "lead", subscribed: false, jobTitle: "", createdAt: new Date(Date.now() - 60 * 864e5).toISOString() },
  ];
  const ids = (match: "all" | "any", filters: { field: string; op: string; value: string }[]) => segmentContacts({ match, filters }, people).map((c) => c.id);

  it("returns everyone when there are no filters", () => expect(ids("all", [])).toEqual(["a", "b"]));
  it("matches exact values, including yes/no fields", () => {
    expect(ids("all", [{ field: "lifecycleStage", op: "is", value: "customer" }])).toEqual(["a"]);
    expect(ids("all", [{ field: "subscribed", op: "is", value: "true" }])).toEqual(["a"]);
    expect(ids("all", [{ field: "lifecycleStage", op: "is_not", value: "customer" }])).toEqual(["b"]);
  });
  it("matches text case-insensitively", () => expect(ids("all", [{ field: "jobTitle", op: "contains", value: "EVENTS" }])).toEqual(["a"]));
  it("treats an empty 'contains' value as matching nothing", () => expect(ids("all", [{ field: "jobTitle", op: "contains", value: "" }])).toEqual([]));
  it("handles known and unknown", () => {
    expect(ids("all", [{ field: "jobTitle", op: "is_unknown", value: "" }])).toEqual(["b"]);
    expect(ids("all", [{ field: "jobTitle", op: "is_known", value: "" }])).toEqual(["a"]);
  });
  it("handles 'in the last N days'", () => expect(ids("all", [{ field: "createdAt", op: "in_last_days", value: "30" }])).toEqual(["a"]));
  it("combines filters with all and any", () => {
    const filters = [
      { field: "lifecycleStage", op: "is", value: "lead" },
      { field: "email", op: "contains", value: "hotel" },
    ];
    expect(ids("all", filters)).toEqual([]);
    expect(ids("any", filters)).toEqual(["a", "b"]);
  });
  it("fills in personalisation tokens, with fallbacks", () => {
    expect(renderTokens("Hi {{firstName}} at {{company}}", people[0], undefined)).toBe("Hi Ann at your company");
    expect(renderTokens("Hi {{firstName}}", null, null)).toBe("Hi there");
  });
});

describe("scheduling", () => {
  const profile: Profile = { id: "u_me", phone: "", slug: "x", bookingEnabled: true, meetingTitle: "Intro", duration: 30, days: [1, 2, 3, 4, 5], startHour: 9, endHour: 11, timezone: "America/New_York" };
  // Sunday 8 Nov 2026, 12:00 UTC
  const now = Date.UTC(2026, 10, 8, 12);

  it("converts local times to UTC in winter and summer", () => {
    expect(zonedToUtc("2026-11-12", 9 * 60, "America/New_York").toISOString()).toBe("2026-11-12T14:00:00.000Z");
    expect(zonedToUtc("2026-07-15", 9 * 60, "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z");
    expect(zonedToUtc("2026-11-12", 9 * 60, "Asia/Tokyo").toISOString()).toBe("2026-11-12T00:00:00.000Z");
  });

  it("gets the day the clocks go back right", () => {
    // US clocks go back on 1 Nov 2026: 9:00 is EST (UTC-5) that morning.
    expect(zonedToUtc("2026-11-01", 9 * 60, "America/New_York").toISOString()).toBe("2026-11-01T14:00:00.000Z");
    expect(zonedToUtc("2026-10-31", 9 * 60, "America/New_York").toISOString()).toBe("2026-10-31T13:00:00.000Z");
  });

  it("offers slots only on bookable weekdays, within working hours", () => {
    const days = availableSlots(profile, [], now, 7);
    expect(days.map((d) => d.date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]);
    expect(days[0].slots).toEqual(["2026-11-09T14:00:00.000Z", "2026-11-09T14:30:00.000Z", "2026-11-09T15:00:00.000Z", "2026-11-09T15:30:00.000Z"]);
  });

  it("hides slots that are booked, but frees them when the booking is cancelled", () => {
    const booking = { userId: "u_me", start: "2026-11-09T14:30:00.000Z", end: "2026-11-09T15:00:00.000Z", status: "scheduled" } as Booking;
    expect(availableSlots(profile, [booking], now, 2)[0].slots).not.toContain("2026-11-09T14:30:00.000Z");
    expect(availableSlots(profile, [{ ...booking, status: "cancelled" }], now, 2)[0].slots).toContain("2026-11-09T14:30:00.000Z");
    expect(availableSlots(profile, [{ ...booking, userId: "someone_else" }], now, 2)[0].slots).toContain("2026-11-09T14:30:00.000Z");
  });

  it("blocks a longer meeting that would overlap a booking", () => {
    const booking = { userId: "u_me", start: "2026-11-09T14:30:00.000Z", end: "2026-11-09T15:00:00.000Z", status: "scheduled" } as Booking;
    const slots = availableSlots({ ...profile, duration: 60 }, [booking], now, 2)[0].slots;
    expect(slots).toEqual(["2026-11-09T15:00:00.000Z"]);
  });

  it("does not offer anything less than two hours ahead", () => {
    const mondayMorning = Date.UTC(2026, 10, 9, 13, 30); // 8:30 in New York
    expect(availableSlots(profile, [], mondayMorning, 1)[0]?.slots ?? []).toEqual(["2026-11-09T15:30:00.000Z"]);
  });

  it("writes a calendar file other calendars can read", () => {
    const ics = icsFor({ id: "b_1", userId: "u_me", contactId: null, title: "Intro, part 1", start: "2026-11-09T14:00:00.000Z", end: "2026-11-09T14:30:00.000Z", status: "scheduled", guestName: "Gina", guestEmail: "g@test.example", notes: "", createdAt: "2026-11-08T12:00:00.000Z", updatedAt: "" }, me);
    expect(ics).toContain("DTSTART:20261109T140000Z");
    expect(ics).toContain("DTEND:20261109T143000Z");
    expect(ics).toContain("SUMMARY:Intro\\, part 1");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.split("\r\n").at(-1)).toBe("END:VCALENDAR");
  });

  it("makes readable, unique booking links", () => {
    expect(slugify("Alex Carter", "u_abc1234")).toBe("alex-carter-1234");
    expect(slugify("  ", "u_abc1234")).toBe("meet-1234");
  });
});

describe("automation workflows", () => {
  const meta = { seed: "w1", now: "2026-11-10T12:00:00.000Z", userId: "u_me" };

  it("runs the matching workflow's actions in order", () => {
    const db = buildSeed(me);
    const contact = db.contacts.find((c) => c.lifecycleStage === "lead")!;
    const tasksBefore = db.tasks.length;
    const emails = runWorkflows(db, [{ type: "form_submitted", contactId: contact.id, value: "f_2" }], meta);
    expect(contact.lifecycleStage).toBe("mql");
    expect(db.tasks.length).toBe(tasksBefore + 1);
    expect(db.tasks[0].title).toBe(`Call ${contact.firstName} ${contact.lastName} about their demo request`);
    expect(db.tasks[0].dueDate).toBe("2026-11-11");
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ to: contact.email, subject: `Thanks for your interest, ${contact.firstName}` });
    expect(db.workflowRuns[0]).toMatchObject({ workflowId: "w_1", contactId: contact.id });
  });

  it("ignores workflows that are off or whose trigger value differs", () => {
    const db = buildSeed(me);
    const contact = db.contacts[0];
    expect(runWorkflows(db, [{ type: "form_submitted", contactId: contact.id, value: "f_1" }], meta)).toEqual([]); // w_3 is off
    expect(db.workflowRuns).toHaveLength(0);
    runWorkflows(db, [{ type: "deal_stage_changed", dealId: db.deals[0].id, value: "demo" }], meta); // w_2 wants "won"
    expect(db.workflowRuns).toHaveLength(0);
  });

  it("acts on the deal's first contact for deal triggers", () => {
    const db = buildSeed(me);
    const deal = db.deals.find((d) => d.contactIds.length > 0)!;
    const contact = db.contacts.find((c) => c.id === deal.contactIds[0])!;
    runWorkflows(db, [{ type: "deal_stage_changed", dealId: deal.id, value: "won" }], meta);
    expect(contact.lifecycleStage).toBe("customer");
    expect(db.workflowRuns[0]).toMatchObject({ workflowId: "w_2", dealId: deal.id });
  });

  it("refuses to set a property to a value that is not allowed", () => {
    const db = buildSeed(me);
    db.workflows = [{ id: "w_x", name: "Bad", enabled: true, trigger: { type: "contact_created", value: "" }, actions: [{ type: "set_property", field: "email", value: "evil@x.example" }, { type: "set_property", field: "lifecycleStage", value: "not-a-stage" }], createdAt: "", updatedAt: "" }];
    const contact = db.contacts[0];
    const before = { ...contact };
    runWorkflows(db, [{ type: "contact_created", contactId: contact.id }], meta);
    expect(contact).toEqual(before);
  });
});

describe("phone numbers", () => {
  it("accepts international numbers and tidies their formatting", () => {
    expect(e164("+1 (212) 555-0123")).toBe("+12125550123");
    expect(e164("+44 20 7946 0958")).toBe("+442079460958");
  });
  it("rejects numbers without a country code", () => {
    expect(e164("212 555 0123")).toBe("");
    expect(e164("")).toBe("");
  });
});
