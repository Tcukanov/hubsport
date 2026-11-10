"use client";

import { Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActivityIndex } from "@/components/activity-index";
import { useData } from "@/components/data";
import { Badge, Button, Card, Empty, Field, Tabs, Toggle, cx, inputCls } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { displayName } from "@/lib/objects";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 25 }, (_, h) => h);
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 || h === 24 ? "AM" : "PM"}`;

function Scheduled() {
  const { db, update } = useData();
  const [nowIso] = useState(() => new Date().toISOString());
  const [past, setPast] = useState(false);
  const all = [...db.bookings].sort((a, b) => a.start.localeCompare(b.start));
  const list = past ? all.filter((b) => b.end < nowIso).reverse() : all.filter((b) => b.end >= nowIso);

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {[false, true].map((p) => (
          <button key={String(p)} type="button" onClick={() => setPast(p)} className={cx("rounded-full px-3 py-1 text-xs font-medium", past === p ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100")}>
            {p ? "Past" : "Upcoming"}
          </button>
        ))}
      </div>
      <Card className="overflow-x-auto">
        {list.length === 0 ? (
          <Empty title={past ? "No past bookings" : "No upcoming bookings"} hint="Share your booking page and meetings people schedule will appear here." />
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Meeting</th>
                <th className="px-4 py-2.5 font-medium">Guest</th>
                <th className="px-4 py-2.5 font-medium">Host</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {list.map((b) => {
                const contact = db.contacts.find((c) => c.id === b.contactId);
                const host = db.users.find((u) => u.id === b.userId);
                const cancelled = b.status === "cancelled";
                return (
                  <tr key={b.id} className="align-top hover:bg-stone-50">
                    <td className={cx("whitespace-nowrap px-4 py-2.5 font-medium", cancelled ? "text-stone-400 line-through" : "text-stone-900")}>{fmtDateTime(b.start)}</td>
                    <td className="px-4 py-2.5 text-stone-700">
                      {b.title}
                      {b.notes && <span className="block max-w-xs truncate text-xs text-stone-500">“{b.notes}”</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {contact ? (
                        <Link href={`/contacts/${contact.id}`} className="font-medium text-teal-700 hover:underline">
                          {displayName("contacts", contact)}
                        </Link>
                      ) : (
                        b.guestName
                      )}
                      <span className="block text-xs text-stone-500">{b.guestEmail}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-stone-700">{host?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={cancelled ? "stone" : "emerald"}>{cancelled ? "Cancelled" : "Scheduled"}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <a href={`/api/public/ics/${b.id}`} className="mr-3 text-sm font-medium text-teal-700 hover:underline">
                        Calendar file
                      </a>
                      {!past && (
                        <button type="button" className="text-sm font-medium text-stone-600 hover:text-rose-600 hover:underline" onClick={() => update("bookings", b.id, { status: cancelled ? "scheduled" : "cancelled" })}>
                          {cancelled ? "Restore" : "Cancel"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function BookingPage() {
  const { db, me, update } = useData();
  const profile = db.profiles.find((p) => p.id === me.id);
  const [copied, setCopied] = useState(false);
  if (!profile) return <Empty title="Your booking page is being set up" hint="Reload in a moment." />;

  const set = (patch: Record<string, unknown>) => update("profiles", me.id, patch);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/meet/${profile.slug}`;
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [profile.timezone];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card title="Availability">
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Meeting name">
              <input className={inputCls} value={profile.meetingTitle} onChange={(e) => set({ meetingTitle: e.target.value })} />
            </Field>
            <Field label="Length">
              <select className={inputCls} value={profile.duration} onChange={(e) => set({ duration: Number(e.target.value) })}>
                {[15, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-stone-600">Bookable days</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((label, day) => {
                const on = profile.days.includes(day);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ days: on ? profile.days.filter((d) => d !== day) : [...profile.days, day].sort() })}
                    className={cx("rounded-full border px-3 py-1.5 text-sm font-medium", on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="From">
              <select className={inputCls} value={profile.startHour} onChange={(e) => set({ startHour: Number(e.target.value) })}>
                {HOURS.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Until">
              <select className={inputCls} value={profile.endHour} onChange={(e) => set({ endHour: Number(e.target.value) })}>
                {HOURS.filter((h) => h > profile.startHour).map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Your time zone">
              <select className={inputCls} value={profile.timezone} onChange={(e) => set({ timezone: e.target.value })}>
                {zones.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-xs text-stone-500">Changes save automatically. Guests see times in their own time zone, cannot book less than two hours ahead, and cannot take a slot that is already booked.</p>
        </div>
      </Card>

      <Card title="Your booking link">
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-stone-700">{profile.bookingEnabled ? "Accepting bookings" : "Bookings are paused"}</span>
            <Toggle on={profile.bookingEnabled} label="Accept bookings" onChange={(v) => set({ bookingEnabled: v })} />
          </div>
          <input aria-label="Booking link" readOnly className={`${inputCls} font-mono text-xs`} value={url} onFocus={(e) => e.target.select()} />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(url);
                setCopied(true);
              }}
            >
              <Copy size={14} />
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={`/meet/${profile.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50">
              <ExternalLink size={14} />
              Open page
            </a>
          </div>
          <p className="text-xs text-stone-500">Each booking creates or updates the contact, logs a meeting on their timeline, and emails both of you a confirmation with a calendar file.</p>
        </div>
      </Card>
    </div>
  );
}

export default function MeetingsPage() {
  const { db } = useData();
  const [tab, setTab] = useState<"scheduled" | "logged" | "page">("scheduled");
  const [nowIso] = useState(() => new Date().toISOString());
  const upcoming = db.bookings.filter((b) => b.status === "scheduled" && b.end >= nowIso).length;

  return (
    <div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "scheduled", label: "Scheduled", count: upcoming },
          { value: "logged", label: "Logged meetings" },
          { value: "page", label: "My booking page" },
        ]}
      />
      <div className="mt-5">
        {tab === "scheduled" && <Scheduled />}
        {tab === "logged" && <ActivityIndex type="meeting" />}
        {tab === "page" && <BookingPage />}
      </div>
    </div>
  );
}
