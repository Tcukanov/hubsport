"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtDate, money } from "@/lib/format";
import type { PropDef } from "@/lib/objects";
import type { AnyRec, DB } from "@/lib/types";
import { Avatar, Badge, inputCls } from "./ui";

/** Read-only display of one property value. */
export function PropValue({ def, rec, db }: { def: PropDef; rec: AnyRec; db: DB }) {
  const v = rec[def.key];
  if (def.type === "bool") return <span>{v ? "Yes" : "No"}</span>;
  if (v === null || v === undefined || v === "") return <span className="text-stone-400">—</span>;
  switch (def.type) {
    case "select": {
      const opt = def.options?.find((o) => o.value === v);
      return opt?.tone ? <Badge tone={opt.tone}>{opt.label}</Badge> : <span>{opt?.label ?? v}</span>;
    }
    case "user": {
      const u = db.users.find((x) => x.id === v);
      if (!u) return <span className="text-stone-400">—</span>;
      return (
        <span className="inline-flex items-center gap-1.5">
          <Avatar name={u.name} color={u.color} size={20} />
          {u.name}
        </span>
      );
    }
    case "company": {
      const c = db.companies.find((x) => x.id === v);
      if (!c) return <span className="text-stone-400">—</span>;
      return (
        <Link href={`/companies/${c.id}`} className="text-teal-700 hover:underline">
          {c.name}
        </Link>
      );
    }
    case "money":
      return <span className="tabular-nums">{money(v)}</span>;
    case "date":
      return <span>{fmtDate(v)}</span>;
    default:
      return <span>{String(v)}</span>;
  }
}

export function sortValue(def: PropDef | undefined, rec: AnyRec, db: DB): string | number {
  const key = def?.key ?? "createdAt";
  const v = rec[key];
  if (def?.type === "user") return db.users.find((u) => u.id === v)?.name ?? "";
  if (def?.type === "company") return db.companies.find((c) => c.id === v)?.name ?? "";
  if (def?.type === "select") return def.options?.findIndex((o) => o.value === v) ?? 0;
  if (def?.type === "money" || def?.type === "number") return Number(v) || 0;
  return String(v ?? "").toLowerCase();
}

/** Editable input for one property. Text-like inputs commit on blur, pickers on change. */
export function PropField({ def, value, onChange, db }: { def: PropDef; value: unknown; onChange: (v: unknown) => void; db: DB }) {
  const [draft, setDraft] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    // The record changed elsewhere: reset the draft to the saved value.
    setSeen(value);
    setDraft(value ?? "");
  }

  if (def.type === "bool")
    return <input type="checkbox" aria-label={def.label} className="h-4 w-4 accent-teal-600" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;

  if (def.type === "select" || def.type === "user" || def.type === "company") {
    const options =
      def.type === "select" ? def.options! : def.type === "user" ? db.users.map((u) => ({ value: u.id, label: u.name })) : db.companies.map((c) => ({ value: c.id, label: c.name }));
    return (
      <select aria-label={def.label} className={inputCls} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        {def.type !== "select" && <option value="">None</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  const numeric = def.type === "money" || def.type === "number";
  const commit = () => {
    const next = numeric ? (draft === "" ? null : Number(draft)) : draft;
    if (next !== (value ?? "")) onChange(next);
  };
  return (
    <input
      aria-label={def.label}
      className={inputCls}
      type={numeric ? "number" : def.type === "date" ? "date" : def.type === "email" ? "email" : "text"}
      value={draft as string | number}
      onChange={(e) => {
        setDraft(e.target.value);
        if (def.type === "date") onChange(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
