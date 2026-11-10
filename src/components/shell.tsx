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
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  Target,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { displayName } from "@/lib/objects";
import { call, useData } from "./data";
import { Logo } from "./logo";
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
      { href: "/emails", label: "Marketing emails", icon: Mail },
      { href: "/forms", label: "Forms", icon: ClipboardList },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/prospecting", label: "Prospecting agent", icon: Target },
      { href: "/activity", label: "Activity feed", icon: Activity },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/dashboards", label: "Dashboards", icon: BarChart3 },
      { href: "/automation", label: "Automation", icon: Workflow },
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
        className="w-full rounded-full border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:bg-white"
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

function UserMenu() {
  const { me } = useData();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative ml-auto">
      <button type="button" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} onBlur={() => setTimeout(() => setOpen(false), 150)} className="flex items-center gap-2 rounded-full p-1 text-sm text-stone-700 hover:bg-stone-100">
        <span className="hidden pl-2 sm:inline">{me.name}</span>
        <Avatar name={me.name} color={me.color} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          <div className="border-b border-stone-100 px-3 py-2">
            <p className="truncate text-sm font-medium text-stone-900">{me.name}</p>
            <p className="truncate text-xs text-stone-500">{me.email}</p>
          </div>
          <button type="button" onMouseDown={() => router.push("/settings")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">
            <Settings size={15} />
            Settings and users
          </button>
          <button
            type="button"
            onMouseDown={async () => {
              await call("auth/logout", {});
              window.location.href = "/login";
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const link = (item: { href: string; label: string; icon: typeof Home }) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setNavOpen(false)}
      className={cx("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium", isActive(item.href) ? "bg-white/10 text-white" : "text-stone-300 hover:bg-white/5 hover:text-white")}
    >
      <item.icon size={17} />
      {item.label}
    </Link>
  );

  const nav = (
    <nav className="flex h-full flex-col gap-4 overflow-y-auto bg-stone-900 px-3 py-4">
      <Link href="/" className="px-2" onClick={() => setNavOpen(false)}>
        <Logo light />
      </Link>
      {NAV.map((group) => (
        <div key={group.label || "top"}>
          {group.label && <p className="mb-1 px-2.5 text-xs font-medium text-stone-500">{group.label}</p>}
          {group.items.map(link)}
        </div>
      ))}
      <div className="mt-auto border-t border-white/10 pt-3">{link({ href: "/settings", label: "Settings", icon: Settings })}</div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 lg:block">{nav}</aside>
      {navOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 lg:hidden" onClick={() => setNavOpen(false)}>
          <aside className="h-full w-64" onClick={(e) => e.stopPropagation()}>
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
          <UserMenu />
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
