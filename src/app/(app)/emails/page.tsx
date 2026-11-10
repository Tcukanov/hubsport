"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/components/data";
import { Badge, Button, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate, pct } from "@/lib/format";

export default function EmailsPage() {
  const { db, create, remove, me } = useData();
  const router = useRouter();

  return (
    <div>
      <PageHeader title="Marketing emails" subtitle="Write an email, pick a segment, send, and track opens and clicks.">
        <Button
          variant="primary"
          onClick={() => {
            const e = create("emails", {
              name: "Untitled email",
              subject: "",
              previewText: "",
              fromName: `${me.name.split(" ")[0]} at Pipeline`,
              fromEmail: me.email,
              body: "Hi {{firstName}},\n\nWrite your message here.",
              ctaLabel: "",
              ctaUrl: "https://example.com",
              segmentId: db.segments[0]?.id ?? null,
              status: "draft",
              sentAt: null,
            });
            router.push(`/emails/${e.id}`);
          }}
        >
          <Plus size={16} />
          Create email
        </Button>
      </PageHeader>
      <Card className="overflow-x-auto">
        {db.emails.length === 0 ? (
          <Empty title="No emails yet" hint="Create your first marketing email." />
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Sent to</th>
                <th className="px-4 py-2.5 font-medium">Open rate</th>
                <th className="px-4 py-2.5 font-medium">Click rate</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {db.emails.map((e) => {
                const sends = db.sends.filter((s) => s.emailId === e.id);
                const delivered = sends.filter((s) => s.delivered).length;
                const sent = e.status === "sent";
                return (
                  <tr key={e.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/emails/${e.id}`} className="font-medium text-violet-700 hover:underline">
                        {e.name}
                      </Link>
                      <span className="block max-w-xs truncate text-xs text-stone-500">{e.subject || "No subject"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={sent ? "emerald" : "stone"}>{sent ? "Sent" : "Draft"}</Badge>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{sent ? sends.length : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{sent ? pct(sends.filter((s) => s.opened).length, delivered) : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{sent ? pct(sends.filter((s) => s.clicked).length, delivered) : "—"}</td>
                    <td className="px-4 py-2.5 text-stone-600">{fmtDate(e.sentAt ?? e.updatedAt)}</td>
                    <td className="px-4 py-2.5">
                      <button type="button" aria-label={`Delete ${e.name}`} onClick={() => window.confirm(`Delete the email "${e.name}"?`) && remove("emails", e.id)} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-600">
                        <Trash2 size={15} />
                      </button>
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
