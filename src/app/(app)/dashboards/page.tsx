"use client";

import { useState } from "react";
import { useData } from "@/components/data";
import { Card, PageHeader, Stat, inputCls } from "@/components/ui";
import { DEAL_STAGES, LIFECYCLE, OPEN_STAGES } from "@/lib/config";
import { compactMoney, money, pct } from "@/lib/format";

interface Datum {
  label: string;
  value: number;
}

/* One series per chart, so every bar uses the same hue and the title names it. */
function HBars({ data, format = String }: { data: Datum[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5 p-4">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[130px_minmax(0,1fr)_70px] items-center gap-3 text-sm" title={`${d.label}: ${format(d.value)}`}>
          <span className="truncate text-stone-600">{d.label}</span>
          <span className="h-3.5 rounded-r bg-teal-600" style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value ? 3 : 0 }} />
          <span className="text-right font-medium tabular-nums text-stone-900">{format(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function VBars({ data, format = String }: { data: Datum[]; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="p-4">
      <p className="mb-2 h-5 text-sm text-stone-600" aria-live="polite">
        {hover === null ? <span className="text-stone-400">Hover a bar for the exact value</span> : (
          <>
            {data[hover].label}: <span className="font-semibold tabular-nums text-stone-900">{format(data[hover].value)}</span>
          </>
        )}
      </p>
      <div className="flex h-44 items-end gap-[2px] border-b border-stone-200">
        {data.map((d, i) => (
          <div key={d.label} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div
              role="img"
              aria-label={`${d.label}: ${format(d.value)}`}
              className={`w-full rounded-t ${hover === i ? "bg-teal-800" : "bg-teal-600"}`}
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[11px] text-stone-500">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 truncate text-center">
            {data.length > 8 && i % 2 ? "" : d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardsPage() {
  const { db } = useData();
  const [owner, setOwner] = useState("");
  const deals = db.deals.filter((d) => !owner || d.ownerId === owner);
  const contacts = db.contacts.filter((c) => !owner || c.ownerId === owner);

  const open = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const won = deals.filter((d) => d.stage === "won");
  const lost = deals.filter((d) => d.stage === "lost");
  const weighted = open.reduce((s, d) => s + d.amount * (DEAL_STAGES.find((x) => x.value === d.stage)?.prob ?? 0), 0);

  const byStage = DEAL_STAGES.filter((s) => OPEN_STAGES.includes(s.value)).map((s) => ({ label: s.label, value: open.filter((d) => d.stage === s.value).reduce((sum, d) => sum + d.amount, 0) }));
  const lifecycle = LIFECYCLE.map((s) => ({ label: s.label, value: contacts.filter((c) => c.lifecycleStage === s.value).length }));

  const [nowMs] = useState(() => Date.now());
  const now = new Date(nowMs);
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const wonByMonth = months.map((m) => {
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    return { label: m.toLocaleDateString("en-US", { month: "short" }), value: won.filter((d) => d.closeDate.startsWith(key)).reduce((s, d) => s + d.amount, 0) };
  });

  const weeks = Array.from({ length: 12 }, (_, i) => {
    const end = nowMs - (11 - i) * 7 * 864e5;
    const start = end - 7 * 864e5;
    return {
      label: new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: contacts.filter((c) => {
        const t = new Date(c.createdAt).getTime();
        return t > start && t <= end;
      }).length,
    };
  });

  const wonByOwner = db.users.map((u) => ({ label: u.name, value: db.deals.filter((d) => d.stage === "won" && d.ownerId === u.id).reduce((s, d) => s + d.amount, 0) }));
  const sentEmails = db.emails.filter((e) => e.status === "sent");

  return (
    <div>
      <PageHeader title="Dashboards" subtitle="Sales and marketing performance, calculated live from your records.">
        <select aria-label="Filter by owner" className={`${inputCls} !w-auto`} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">All owners</option>
          {db.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open pipeline" value={compactMoney(open.reduce((s, d) => s + d.amount, 0))} hint={`${open.length} deals`} />
        <Stat label="Weighted forecast" value={compactMoney(weighted)} hint="Amount × stage probability" />
        <Stat label="Closed won" value={compactMoney(won.reduce((s, d) => s + d.amount, 0))} hint={`${won.length} deals`} />
        <Stat label="Win rate" value={pct(won.length, won.length + lost.length)} hint={`${won.length} won · ${lost.length} lost`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Open pipeline value by stage">
          <HBars data={byStage} format={money} />
        </Card>
        <Card title="Closed won revenue by month">
          <VBars data={wonByMonth} format={money} />
        </Card>
        <Card title="Contacts by lifecycle stage">
          <HBars data={lifecycle} />
        </Card>
        <Card title="New contacts per week (last 12 weeks)">
          <VBars data={weeks} />
        </Card>
        <Card title="Closed won revenue by owner (all owners)">
          <HBars data={wonByOwner} format={money} />
        </Card>
        <Card title="Marketing email performance" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                <th className="px-4 py-2.5 text-right font-medium">Open rate</th>
                <th className="px-4 py-2.5 text-right font-medium">Click rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sentEmails.map((e) => {
                const sends = db.sends.filter((s) => s.emailId === e.id);
                const delivered = sends.filter((s) => s.delivered).length;
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5 text-stone-800">{e.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{sends.length}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{pct(sends.filter((s) => s.opened).length, delivered)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{pct(sends.filter((s) => s.clicked).length, delivered)}</td>
                  </tr>
                );
              })}
              {sentEmails.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                    No emails sent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
