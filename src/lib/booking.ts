/* Meeting scheduling: working out which time slots a person can be booked for.
   Pure functions, used by the server (to offer and validate slots). */
import type { Booking, Profile } from "./types";

const DAY = 864e5;

/** How far ahead of UTC a time zone is at a given moment, in milliseconds. */
function offsetMs(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-11-12", 9:30 (as 570 minutes) in a time zone -> the matching moment in UTC. */
export function zonedToUtc(date: string, minutes: number, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  // Two passes so days when the clocks change come out right.
  const first = naive - offsetMs(naive, timeZone);
  return new Date(naive - offsetMs(first, timeZone));
}

export function validTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export interface DaySlots {
  date: string;
  slots: string[];
}

/** Free slots for the next `days` days, as UTC timestamps grouped by the host's calendar date. */
export function availableSlots(profile: Profile, bookings: Booking[], nowMs: number, days = 14): DaySlots[] {
  const tz = validTimeZone(profile.timezone) ? profile.timezone : "UTC";
  const duration = Math.max(15, Number(profile.duration) || 30);
  const taken = bookings.filter((b) => b.userId === profile.id && b.status === "scheduled").map((b) => [Date.parse(b.start), Date.parse(b.end)]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(nowMs)); // YYYY-MM-DD in the host's zone
  const [y, m, d] = today.split("-").map(Number);
  const earliest = nowMs + 2 * 3600_000; // no bookings less than two hours ahead
  const out: DaySlots[] = [];

  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(y, m - 1, d) + i * DAY);
    if (!profile.days.includes(day.getUTCDay())) continue;
    const date = day.toISOString().slice(0, 10);
    const slots: string[] = [];
    for (let t = profile.startHour * 60; t + duration <= profile.endHour * 60; t += duration) {
      const start = zonedToUtc(date, t, tz).getTime();
      const end = start + duration * 60_000;
      if (start < earliest) continue;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      slots.push(new Date(start).toISOString());
    }
    if (slots.length) out.push({ date, slots });
  }
  return out;
}

const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** A calendar invite file (.ics) that Google Calendar, Outlook and Apple Calendar can all open. */
export function icsFor(booking: Booking, host: { name: string; email: string }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pipeline CRM//Scheduling//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.id}@pipeline-crm`,
    `DTSTAMP:${stamp(booking.createdAt)}`,
    `DTSTART:${stamp(booking.start)}`,
    `DTEND:${stamp(booking.end)}`,
    `SUMMARY:${escapeIcs(booking.title)}`,
    `DESCRIPTION:${escapeIcs(`${host.name} and ${booking.guestName}${booking.notes ? `\n\n${booking.notes}` : ""}`)}`,
    `ORGANIZER;CN=${escapeIcs(host.name)}:mailto:${host.email}`,
    `ATTENDEE;CN=${escapeIcs(booking.guestName)}:mailto:${booking.guestEmail}`,
    `STATUS:${booking.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function slugify(name: string, id: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "meet"}-${id.replace(/[^a-z0-9]/gi, "").slice(-4).toLowerCase()}`;
}

export function defaultProfile(user: { id: string; name: string }): Profile {
  return { id: user.id, phone: "", slug: slugify(user.name, user.id), bookingEnabled: true, meetingTitle: "30-minute meeting", duration: 30, days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, timezone: "America/New_York" };
}
