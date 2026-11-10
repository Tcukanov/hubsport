"use client";

import {
  Activity,
  BarChart3,
  Building2,
  CheckSquare,
  ClipboardList,
  Filter,
  Handshake,
  Home,
  Mail,
  Menu,
  RotateCcw,
  Search,
  Users,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { displayName } from "@/lib/objects";
import { useData } from "./data";
import { Avatar, cx } from "./ui";

const NAV = [
  { label: "", items: [{ href: "/", label: "Home", icon: Home }] },
  {
    label: "CRM",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/deals", label: "Deals", icon: Handshake },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/segments", label: "Segments", icon: Filter },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/emails", label: "Emails", icon: Mail },
      { href: "/forms", label: "Forms", icon: ClipboardList },
    ],
  },
  {
    label: "Reporting",
    items: [
      { href: "/activity", label: "Activity feed", icon: Activity },
      { href: "/dashboards", label: "Dashboards", icon: BarChart3 },
    ],
  },
];

function GlobalSearch() {
  const { db } = useData();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const hit = (s: string) => s.toLowerCase().includes(term);
    return [
      ...db.contacts.filter((c) => hit(displayName("contacts", c)) || hit(c.email)).map((c) => ({ href: `/contacts/${c.id}`, label: displayName("contacts", c), sub: c.email, kind: "Contact" })),
      ...db.companies.filter((c) => hit(c.name) || hit(c.domain)).map((c) => ({ href: `/companies/${c.id}`, label: c.name, sub: c.domain, kind: "Company" })),
      ...db.deals.filter((d) => hit(d.name)).map((d) => ({ href: `/deals/${d.id}`, label: d.name, sub: "", kind: "Deal" })),
    ].slice(0, 8);
  }, [q, db]);

  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input
        aria-label="Search contacts, companies and deals"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search contacts, companies, deals"
        className="w-full rounded-md border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:bg-white"
      />
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
          {results.length === 0 && <p className="px-3 py-3 text-sm text-stone-500">No matches for “{q}”.</p>}
          {results.map((r) => (
            <button
              key={r.href}
              type="button"
              onMouseDown={() => {
                router.push(r.href);
                setQ("");
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-stone-900">{r.label}</span>
                {r.sub && <span className="block truncate text-xs text-stone-500">{r.sub}</span>}
              </span>
              <span className="text-xs text-stone-400">{r.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me, reset } = useData();
  const [navOpen, setNavOpen] = useState(false);

  const nav = (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4">
      <Link href="/" className="flex items-center gap-2 px-2 text-stone-900" onClick={() => setNavOpen(false)}>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
          <Waypoints size={18} />
        </span>
        <span className="text-lg font-semibold tracking-tight">Pipeline</span>
      </Link>
      {NAV.map((group) => (
        <div key={group.label || "top"}>
          {group.label && <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{group.label}</p>}
          {group.items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setNavOpen(false)}
                className={cx(
                  "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium",
                  active ? "bg-violet-50 text-violet-700" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
                )}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
      <button
        type="button"
        onClick={() => window.confirm("Reset everything back to the demo data?") && reset()}
        className="mt-auto flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900"
      >
        <RotateCcw size={16} />
        Reset demo data
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-stone-200 bg-white lg:block">{nav}</aside>
      {navOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 lg:hidden" onClick={() => setNavOpen(false)}>
          <aside className="h-full w-64 bg-white" onClick={(e) => e.stopPropagation()}>
            {nav}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:px-8">
          <button type="button" aria-label="Open menu" className="rounded p-1.5 text-stone-600 hover:bg-stone-100 lg:hidden" onClick={() => setNavOpen(true)}>
            <Menu size={20} />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2 text-sm text-stone-700">
            <span className="hidden sm:inline">{me.name}</span>
            <Avatar name={me.name} color={me.color} />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
