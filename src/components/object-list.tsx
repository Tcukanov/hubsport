"use client";

import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { OBJECTS, displayName, type ObjectKind } from "@/lib/objects";
import type { AnyRec, Patch } from "@/lib/types";
import { useData } from "./data";
import { PropField, PropValue, sortValue } from "./props";
import { Button, Drawer, Empty, Field, PageHeader, inputCls } from "./ui";

const PAGE = 25;

export function CreateRecordDrawer({ kind, open, onClose, initial }: { kind: ObjectKind; open: boolean; onClose: () => void; initial?: Patch }) {
  const cfg = OBJECTS[kind];
  const { db, create, me } = useData();
  const hasOwner = cfg.props.some((p) => p.key === "ownerId");
  const blank = () => ({ ...cfg.defaults(), ...(hasOwner ? { ownerId: me.id } : {}), ...initial });
  const [values, setValues] = useState<Patch>(blank);
  const nameOk = kind === "contacts" ? values.email || values.firstName || values.lastName : values.name;

  const close = () => {
    setValues(blank());
    onClose();
  };
  const save = () => {
    // A ticket or order for a contact belongs to that contact's company too.
    const viaContact = "contactId" in values && !values.companyId ? db.contacts.find((c) => c.id === values.contactId)?.companyId : undefined;
    create(kind, viaContact ? { ...values, companyId: viaContact } : values);
    close();
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title={`Create ${cfg.singular.toLowerCase()}`}
      footer={
        <>
          <Button variant="primary" disabled={!nameOk} onClick={save}>
            Create
          </Button>
          <Button onClick={close}>Cancel</Button>
        </>
      }
    >
      {cfg.createKeys.map((key) => {
        const def = cfg.props.find((p) => p.key === key)!;
        return (
          <Field key={key} label={def.label}>
            <PropField live def={def} value={values[key]} db={db} onChange={(v) => setValues((s) => ({ ...s, [key]: v }))} />
          </Field>
        );
      })}
    </Drawer>
  );
}

export function ObjectList({ kind, headerExtra, hideHeader }: { kind: ObjectKind; headerExtra?: React.ReactNode; hideHeader?: boolean }) {
  const cfg = OBJECTS[kind];
  const { db, removeMany } = useData();
  const rows = db[kind] as AnyRec[];
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "createdAt", dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);

  const filterDefs = cfg.props.filter((p) => p.filter);
  const columns = cfg.columns.map((key) => cfg.props.find((p) => p.key === key)!);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (term && !`${displayName(kind, r)} ${r.email ?? ""} ${r.domain ?? ""}`.toLowerCase().includes(term)) return false;
      return Object.entries(filters).every(([k, v]) => !v || r[k] === v);
    });
    const def = cfg.props.find((p) => p.key === sort.key);
    const val = (r: AnyRec) => (sort.key === "__name" ? displayName(kind, r).toLowerCase() : sortValue(def, r, db));
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, q, filters, sort, kind, cfg, db]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));

  const toggleSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sortHead = (k: string, label: string) => (
    <th key={k} className="px-3 py-2.5 text-left font-medium">
      <button type="button" className="inline-flex items-center gap-1 hover:text-stone-900" onClick={() => toggleSort(k)}>
        {label}
        {sort.key === k && (sort.dir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
      </button>
    </th>
  );

  return (
    <div>
      {!hideHeader && (
        <PageHeader title={cfg.plural} subtitle={`${rows.length} record${rows.length === 1 ? "" : "s"}`}>
          {headerExtra}
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            Create {cfg.singular.toLowerCase()}
          </Button>
        </PageHeader>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            aria-label={`Search ${cfg.plural.toLowerCase()}`}
            className={`${inputCls} pl-9`}
            placeholder={`Search ${cfg.plural.toLowerCase()}`}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
        {filterDefs.map((def) => {
          const options = def.type === "user" ? db.users.map((u) => ({ value: u.id, label: u.name })) : def.options!;
          return (
            <select
              key={def.key}
              aria-label={`Filter by ${def.label}`}
              className={`${inputCls} !w-auto`}
              value={filters[def.key] ?? ""}
              onChange={(e) => {
                setFilters((f) => ({ ...f, [def.key]: e.target.value }));
                setPage(0);
              }}
            >
              <option value="">{def.label}: all</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          );
        })}
        {selected.size > 0 && (
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm(`Delete ${selected.size} ${selected.size === 1 ? cfg.singular.toLowerCase() : cfg.plural.toLowerCase()}?`)) return;
              removeMany(kind, [...selected]);
              setSelected(new Set());
            }}
          >
            <Trash2 size={15} />
            Delete {selected.size}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  className="h-4 w-4 accent-teal-600"
                  checked={allSelected}
                  onChange={() =>
                    setSelected((s) => {
                      const next = new Set(s);
                      visible.forEach((r) => (allSelected ? next.delete(r.id) : next.add(r.id)));
                      return next;
                    })
                  }
                />
              </th>
              {sortHead("__name", "Name")}
              {columns.map((c) => sortHead(c.key, c.label))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-stone-50">
                <td className="px-3 py-2.5">
                  <input type="checkbox" aria-label={`Select ${displayName(kind, r)}`} className="h-4 w-4 accent-teal-600" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td className="max-w-[260px] truncate px-3 py-2.5 font-medium">
                  <Link href={`${cfg.path}/${r.id}`} className="text-teal-700 hover:underline">
                    {displayName(kind, r)}
                  </Link>
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="max-w-[220px] truncate whitespace-nowrap px-3 py-2.5 text-stone-700">
                    <PropValue def={c} rec={r} db={db} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty title={`No ${cfg.plural.toLowerCase()} match`} hint="Try a different search or clear the filters." />}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-stone-500">
        <span>
          {filtered.length === 0 ? 0 : current * PAGE + 1}–{Math.min(filtered.length, current * PAGE + PAGE)} of {filtered.length}
        </span>
        <div className="flex gap-2">
          <Button size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <Button size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Next
          </Button>
        </div>
      </div>

      <CreateRecordDrawer kind={kind} open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
