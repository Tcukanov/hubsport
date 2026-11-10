"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/data";
import { ActivityItem } from "@/components/timeline";
import { Badge, Card, Empty, Stat, cx } from "@/components/ui";
import { DEAL_STAGES, OPEN_STAGES } from "@/lib/config";
import { compactMoney, fmtDate, money, todayYmd } from "@/lib/format";

export default function HomePage() {
  const { db, me, update } = useData();
  const today = todayYmd();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const [nowMs] = useState(() => Date.now());
  const weekAgo = new Date(nowMs - 7 * 864e5).toISOString();
  const monthAgo = new Date(nowMs - 30 * 864e5).toISOString().slice(0, 10);

  const open = db.deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const wonRecent = db.deals.filter((d) => d.stage === "won" && d.closeDate >= monthAgo);
  const myTasks = db.tasks.filter((t) => t.status === "open" && t.ownerId === me.id && t.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const closingSoon = [...open].sort((a, b) => a.closeDate.localeCompare(b.closeDate)).slice(0, 5);
  const recent = [...db.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-stone-500">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      <h1 className="mb-5 mt-1 text-3xl font-semibold tracking-tight text-stone-900">
        {greeting}, {me.name.split(" ")[0]}
      </h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Contacts created this week" value={db.contacts.filter((c) => c.createdAt >= weekAgo).length} hint={`${db.contacts.length} total`} />
        <Stat label="Open pipeline value" value={compactMoney(open.reduce((s, d) => s + d.amount, 0))} hint={`${open.length} open deals`} />
        <Stat label="Closed won, last 30 days" value={compactMoney(wonRecent.reduce((s, d) => s + d.amount, 0))} hint={`${wonRecent.length} deals`} />
        <Stat label="My tasks due" value={myTasks.length} hint="Today and overdue" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card
          title="My tasks due"
          action={
            <Link href="/tasks" className="text-xs font-medium text-violet-700 hover:underline">
              All tasks
            </Link>
          }
        >
          {myTasks.length === 0 ? (
            <Empty title="You have no tasks due" hint="Everything due today is done." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {myTasks.slice(0, 7).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <input type="checkbox" aria-label={`Mark "${t.title}" complete`} className="h-4 w-4 accent-violet-600" checked={false} onChange={() => update("tasks", t.id, { status: "done" })} />
                  <span className="min-w-0 flex-1 truncate text-sm text-stone-900">{t.title}</span>
                  <span className={cx("whitespace-nowrap text-xs", t.dueDate < today ? "font-medium text-rose-600" : "text-stone-500")}>{t.dueDate < today ? `Overdue · ${fmtDate(t.dueDate)}` : "Today"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Deals closing soon"
          action={
            <Link href="/deals" className="text-xs font-medium text-violet-700 hover:underline">
              Open board
            </Link>
          }
        >
          <ul className="divide-y divide-stone-100">
            {closingSoon.map((d) => {
              const stage = DEAL_STAGES.find((s) => s.value === d.stage);
              return (
                <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/deals/${d.id}`} className="block truncate text-sm font-medium text-violet-700 hover:underline">
                      {d.name}
                    </Link>
                    <span className="text-xs text-stone-500">Close {fmtDate(d.closeDate)}</span>
                  </div>
                  {stage && <Badge tone={stage.tone}>{stage.label}</Badge>}
                  <span className="w-20 text-right text-sm font-semibold tabular-nums text-stone-900">{money(d.amount)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card
        className="mt-5"
        title="Recent activity"
        action={
          <Link href="/activity" className="text-xs font-medium text-violet-700 hover:underline">
            See all
          </Link>
        }
      >
        <ul className="divide-y divide-stone-100">
          {recent.map((a) => (
            <ActivityItem key={a.id} a={a} showTarget />
          ))}
        </ul>
      </Card>
    </div>
  );
}
