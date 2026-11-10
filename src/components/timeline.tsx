"use client";

import { ArrowRightLeft, CalendarDays, CheckSquare, ClipboardList, Mail, Megaphone, Phone, Sparkles, StickyNote, Trash2 } from "lucide-react";
import Link from "next/link";
import { fmtDateTime, relTime } from "@/lib/format";
import { displayName } from "@/lib/objects";
import type { Activity, DB } from "@/lib/types";
import { useData } from "./data";

export const ACTIVITY_TYPES: Record<string, { label: string; icon: typeof Mail; tone: string }> = {
  note: { label: "Note", icon: StickyNote, tone: "bg-amber-100 text-amber-700" },
  call: { label: "Call", icon: Phone, tone: "bg-sky-100 text-sky-700" },
  email: { label: "Email", icon: Mail, tone: "bg-violet-100 text-violet-700" },
  meeting: { label: "Meeting", icon: CalendarDays, tone: "bg-emerald-100 text-emerald-700" },
  task: { label: "Task", icon: CheckSquare, tone: "bg-teal-100 text-teal-700" },
  created: { label: "Record created", icon: Sparkles, tone: "bg-stone-100 text-stone-600" },
  stage_change: { label: "Stage change", icon: ArrowRightLeft, tone: "bg-orange-100 text-orange-700" },
  form_submission: { label: "Form submission", icon: ClipboardList, tone: "bg-pink-100 text-pink-700" },
  marketing_email: { label: "Marketing email", icon: Megaphone, tone: "bg-indigo-100 text-indigo-700" },
};

const LOGGED = ["note", "call", "email", "meeting"];

function target(a: Activity, db: DB) {
  if (a.contactId) {
    const c = db.contacts.find((x) => x.id === a.contactId);
    if (c) return { href: `/contacts/${c.id}`, label: displayName("contacts", c) };
  }
  if (a.dealId) {
    const d = db.deals.find((x) => x.id === a.dealId);
    if (d) return { href: `/deals/${d.id}`, label: d.name };
  }
  if (a.companyId) {
    const c = db.companies.find((x) => x.id === a.companyId);
    if (c) return { href: `/companies/${c.id}`, label: c.name };
  }
  return null;
}

export function ActivityItem({ a, showTarget }: { a: Activity; showTarget?: boolean }) {
  const { db, remove } = useData();
  const meta = ACTIVITY_TYPES[a.type] ?? ACTIVITY_TYPES.note;
  const user = db.users.find((u) => u.id === a.userId);
  const t = showTarget ? target(a, db) : null;
  const Icon = meta.icon;
  return (
    <li className="group flex gap-3 px-4 py-3">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium text-stone-900">
            {meta.label}
            {a.subject && LOGGED.includes(a.type) ? ` · ${a.subject}` : ""}
          </span>
          {t && (
            <Link href={t.href} className="text-violet-700 hover:underline">
              {t.label}
            </Link>
          )}
          <span className="text-xs text-stone-400" title={fmtDateTime(a.createdAt)}>
            {user ? `${user.name} · ` : ""}
            {relTime(a.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-stone-600">{a.body}</p>
      </div>
      {LOGGED.includes(a.type) && (
        <button
          type="button"
          aria-label="Delete activity"
          onClick={() => remove("activities", a.id)}
          className="self-start rounded p-1 text-stone-400 opacity-0 hover:bg-stone-100 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={15} />
        </button>
      )}
    </li>
  );
}
