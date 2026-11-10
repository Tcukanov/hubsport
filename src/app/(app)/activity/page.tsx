"use client";

import { useState } from "react";
import { useData } from "@/components/data";
import { ACTIVITY_TYPES, ActivityItem } from "@/components/timeline";
import { Button, Card, Empty, PageHeader, inputCls } from "@/components/ui";

export default function ActivityPage() {
  const { db } = useData();
  const [type, setType] = useState("");
  const [user, setUser] = useState("");
  const [limit, setLimit] = useState(40);

  const list = db.activities
    .filter((a) => (!type || a.type === type) && (!user || a.userId === user))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Activity feed" subtitle="Everything that happened across contacts, companies and deals.">
        <select aria-label="Filter by activity type" className={`${inputCls} !w-auto`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All activity types</option>
          {Object.entries(ACTIVITY_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by user" className={`${inputCls} !w-auto`} value={user} onChange={(e) => setUser(e.target.value)}>
          <option value="">All users</option>
          {db.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </PageHeader>
      <Card>
        {list.length === 0 ? (
          <Empty title="No activity matches" hint="Try a different filter." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.slice(0, limit).map((a) => (
              <ActivityItem key={a.id} a={a} showTarget />
            ))}
          </ul>
        )}
      </Card>
      {list.length > limit && (
        <div className="mt-4 text-center">
          <Button onClick={() => setLimit(limit + 40)}>Show more ({list.length - limit} left)</Button>
        </div>
      )}
    </div>
  );
}
