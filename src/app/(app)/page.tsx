"use client";

import { CalendarDays, ListTodo, Plus, Rss, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/data";
import { ACTIVITY_TYPES, ActivityItem } from "@/components/timeline";
import { Empty, cx } from "@/components/ui";
import { OPEN_STAGES } from "@/lib/config";
import { compactMoney, fmtDate, todayYmd, ymd } from "@/lib/format";
import { displayName } from "@/lib/objects";

function Section({ icon: Icon, title, action, children }: { icon: typeof ListTodo; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <header className="mb-3 flex items-center gap-2.5">
        <Icon size={18} strokeWidth={1.75} className="text-stone-500" />
        <h2 className="flex-1 text-[15px] font-semibold text-stone-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

const box = "overflow-hidden rounded-2xl border border-stone-300 bg-white";
const hour = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function HomePage() {
  const { db, me, update } = useData();
  const [tasksView, setTasksView] = useState<"open" | "done">("open");
  const [type, setType] = useState("");
  const [nowMs] = useState(() => Date.now());
  const today = todayYmd();
  const h = new Date(nowMs).getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const weekAgo = new Date(nowMs - 7 * 864e5).toISOString();
  const weekAgoDay = weekAgo.slice(0, 10);

  const profile = db.profiles.find((p) => p.id === me.id);
  const meetings = db.bookings.filter((b) => b.userId === me.id && b.status === "scheduled" && ymd(new Date(b.start)) === today).sort((a, b) => a.start.localeCompare(b.start));
  const openTasks = db.tasks.filter((t) => t.status === "open" && t.ownerId === me.id && t.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const doneTasks = db.tasks.filter((t) => t.status === "done" && t.ownerId === me.id).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const tasks = tasksView === "open" ? openTasks : doneTasks;
  const feed = db.activities
    .filter((a) => !type || a.type === type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const open = db.deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const wonThisWeek = db.deals.filter((d) => d.stage === "won" && d.closeDate >= weekAgoDay);

  return (
    <div className="mx-auto max-w-[1024px] pb-16 pt-6">
      <p className="text-[15px] font-semibold text-stone-900">{new Date(nowMs).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      <h1 className="mt-2 text-[40px] font-light leading-tight tracking-tight text-stone-900">
        {greeting}, {me.name.split(" ")[0]}
      </h1>

      <Section icon={CalendarDays} title="Meetings">
        <div className={cx(box, "grid md:grid-cols-2")}>
          <div className="border-b border-stone-200 md:border-b-0 md:border-r">
            {meetings.length === 0 ? (
              <p className="px-5 py-10 text-sm text-stone-600">No meetings booked for today.</p>
            ) : (
              <ul className="divide-y divide-stone-200">
                {meetings.map((b) => {
                  const contact = db.contacts.find((c) => c.id === b.contactId);
                  return (
                    <li key={b.id} className="flex gap-3 p-2">
                      <span className="w-20 shrink-0 px-2 py-2 text-sm text-stone-600">{hour(b.start)}</span>
                      <span className="min-w-0 flex-1 rounded-lg bg-stone-100 px-3 py-2">
                        <span className="block truncate text-sm font-semibold text-stone-700">{b.title}</span>
                        <span className="block truncate text-xs text-stone-500">with {contact ? displayName("contacts", contact) : b.guestName}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="p-7">
            <h3 className="text-lg font-semibold text-stone-900">Let people book time with you</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-700">Share your booking page. Meetings land here, on the contact&apos;s timeline, and in both calendars.</p>
            <Link href="/meetings" className="mt-6 inline-flex items-center gap-2 rounded-full bg-teal-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
              <CalendarDays size={16} />
              {profile?.bookingEnabled ? "Open your booking page" : "Set up your booking page"}
            </Link>
          </div>
        </div>
      </Section>

      <Section
        icon={ListTodo}
        title="Tasks"
        action={
          <>
            <Link href="/tasks" aria-label="Create a task" title="Create a task" className="rounded-full p-1.5 text-stone-700 hover:bg-stone-100">
              <Plus size={18} />
            </Link>
            <div className="ml-2 flex overflow-hidden rounded-full border border-stone-400 text-[15px]">
              {(["open", "done"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={tasksView === v} onClick={() => setTasksView(v)} className={cx("px-3.5 py-1", tasksView === v ? "bg-stone-200 text-stone-900" : "bg-white text-stone-800 hover:bg-stone-50", v === "done" && "border-l border-stone-400")}>
                  {v === "open" ? "Open" : "Completed"}
                </button>
              ))}
            </div>
          </>
        }
      >
        <div className={box}>
          {tasks.length === 0 ? (
            <div className="p-5">
              <p className="text-[15px] text-stone-900">{tasksView === "open" ? "You have no tasks today" : "No completed tasks yet"}</p>
              <Link href="/tasks" className="mt-3 inline-flex items-center gap-2 rounded-full border border-stone-400 px-4 py-2 text-[15px] text-stone-900 hover:bg-stone-50">
                <Plus size={16} />
                New Task
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-stone-200">
              {tasks.slice(0, 8).map((t) => {
                const contact = db.contacts.find((c) => c.id === t.contactId);
                return (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <input type="checkbox" aria-label={`Mark "${t.title}" ${t.status === "done" ? "open" : "complete"}`} className="h-4 w-4 accent-teal-800" checked={t.status === "done"} onChange={(e) => update("tasks", t.id, { status: e.target.checked ? "done" : "open" })} />
                    <span className={cx("min-w-0 flex-1 truncate text-[15px]", t.status === "done" ? "text-stone-400 line-through" : "text-stone-900")}>{t.title}</span>
                    {contact && (
                      <Link href={`/contacts/${contact.id}`} className="hidden truncate text-sm text-teal-800 hover:underline sm:block">
                        {displayName("contacts", contact)}
                      </Link>
                    )}
                    <span className={cx("whitespace-nowrap text-sm", t.status === "open" && t.dueDate < today ? "font-medium text-rose-600" : "text-stone-500")}>{t.dueDate === today ? "Today" : fmtDate(t.dueDate)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Section>

      <Section
        icon={Rss}
        title="Activity Feed"
        action={
          <select aria-label="Filter by activity type" className="cursor-pointer bg-transparent text-[15px] font-semibold text-stone-900 outline-none" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All activity types</option>
            {Object.entries(ACTIVITY_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        }
      >
        <div className={box}>
          {feed.length === 0 ? (
            <Empty title="Nothing to show" hint="Activity from contacts, deals and tickets appears here." />
          ) : (
            <ul className="divide-y divide-stone-200">
              {feed.map((a) => (
                <ActivityItem key={a.id} a={a} showTarget />
              ))}
            </ul>
          )}
          <Link href="/activity" className="block border-t border-stone-200 px-5 py-3 text-sm font-semibold text-teal-800 hover:bg-stone-50">
            See all activity
          </Link>
        </div>
      </Section>

      <Section icon={TrendingUp} title="Metrics" action={<span className="text-[15px] font-semibold text-stone-900">This week</span>}>
        <div className={cx(box, "grid divide-y divide-stone-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0")}>
          {[
            { label: "Contacts created", value: db.contacts.filter((c) => c.createdAt >= weekAgo).length },
            { label: "Open pipeline value", value: compactMoney(open.reduce((s, d) => s + d.amount, 0)) },
            { label: "Closed won revenue", value: compactMoney(wonThisWeek.reduce((s, d) => s + d.amount, 0)) },
          ].map((m) => (
            <div key={m.label} className="p-5">
              <p className="text-sm text-stone-600">{m.label}</p>
              <p className="mt-1 text-3xl font-light tabular-nums text-stone-900">{m.value}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
