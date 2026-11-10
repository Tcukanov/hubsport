"use client";

import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ContactRound,
  Ellipsis,
  Filter,
  Handshake,
  Home,
  Inbox,
  LifeBuoy,
  ListChecks,
  ListTodo,
  LogOut,
  Mail,
  Menu,
  Package,
  PanelLeft,
  Phone,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Target,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { OBJECTS, displayName, type ObjectKind } from "@/lib/objects";
import { CallProvider, useCall } from "./call-widget";
import { CreateRecordDrawer } from "./object-list";
import { call, useData } from "./data";
import { LogoMark } from "./logo";
import { Avatar, cx } from "./ui";

type Item = { href: string; label: string; icon: typeof Home };

const I: Record<string, Item> = {
  home: { href: "/", label: "Home", icon: Home },
  contacts: { href: "/contacts", label: "Contacts", icon: ContactRound },
  companies: { href: "/companies", label: "Companies", icon: Building2 },
  deals: { href: "/deals", label: "Deals", icon: Handshake },
  tasks: { href: "/tasks", label: "Tasks", icon: ListTodo },
  segments: { href: "/segments", label: "Segments", icon: Filter },
  tickets: { href: "/tickets", label: "Tickets", icon: LifeBuoy },
  products: { href: "/products", label: "Products", icon: Package },
  orders: { href: "/orders", label: "Orders", icon: ShoppingCart },
  inbox: { href: "/inbox", label: "Inbox", icon: Inbox },
  calls: { href: "/calls", label: "Calls", icon: Phone },
  meetings: { href: "/meetings", label: "Meetings", icon: CalendarDays },
  emails: { href: "/emails", label: "Marketing Emails", icon: Mail },
  forms: { href: "/forms", label: "Forms", icon: ClipboardList },
  prospecting: { href: "/prospecting", label: "Prospecting Agent", icon: Target },
  activity: { href: "/activity", label: "Activity Feed", icon: ListChecks },
  dashboards: { href: "/dashboards", label: "Dashboards", icon: BarChart3 },
  automation: { href: "/automation", label: "Automation Overview", icon: Workflow },
  settings: { href: "/settings", label: "Settings", icon: Settings },
};

/* The sidebar shows the everyday items; everything is also reachable from "More". */
const PINNED: Item[] = [I.contacts, I.companies, I.deals, I.tasks, I.segments];
const GROUPS: { label: string; items: Item[] }[] = [
  { label: "Marketing", items: [I.emails] },
  { label: "Sales", items: [I.prospecting, I.activity] },
  { label: "Platform", items: [I.dashboards, I.automation] },
];
const MORE: { label: string; items: Item[] }[] = [
  { label: "CRM", items: [I.contacts, I.companies, I.deals, I.tickets, I.products, I.orders, I.segments, I.inbox, I.calls, I.meetings, I.tasks] },
  { label: "Marketing", items: [I.emails, I.forms] },
  { label: "Sales", items: [I.prospecting, I.activity, I.calls, I.meetings] },
  { label: "Service", items: [I.tickets, I.inbox] },
  { label: "Automation", items: [I.automation] },
  { label: "Reporting", items: [I.dashboards, I.activity] },
  { label: "Settings", items: [I.settings] },
];

const CHROME = "bg-[#2e2e2e]";

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
      ...db.tickets.filter((t) => hit(t.name)).map((t) => ({ href: `/tickets/${t.id}`, label: t.name, sub: "", kind: "Ticket" })),
      ...db.products.filter((p) => hit(p.name) || hit(p.sku)).map((p) => ({ href: `/products/${p.id}`, label: p.name, sub: p.sku, kind: "Product" })),
      ...db.orders.filter((o) => hit(o.name)).map((o) => ({ href: `/orders/${o.id}`, label: o.name, sub: "", kind: "Order" })),
    ].slice(0, 8);
  }, [q, db]);

  return (
    <div className="relative w-full max-w-md">
      <input
        aria-label="Search contacts, companies, deals and tickets"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Find in Pipeline"
        className="w-full rounded-full border border-white/35 bg-transparent py-2 pl-4 pr-10 text-sm text-white outline-none placeholder:text-white/90 focus:border-white focus:bg-white/10"
      />
      <Search size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-white" />
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

function TopIcon({ href, label, badge, children }: { href: string; label: string; badge?: number; children: React.ReactNode }) {
  return (
    <Link href={href} aria-label={label} title={label} className="relative hidden rounded-full p-2 text-white hover:bg-white/15 sm:block">
      {children}
      {!!badge && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{badge}</span>}
    </Link>
  );
}

const CREATABLE: ObjectKind[] = ["contacts", "companies", "deals", "tickets", "products", "orders"];

function CreateMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ObjectKind | null>(null);
  return (
    <div className="relative hidden sm:block">
      <button type="button" aria-label="Create a record" title="Create a record" aria-expanded={open} onClick={() => setOpen((v) => !v)} onBlur={() => setTimeout(() => setOpen(false), 150)} className="rounded-full p-2 text-white hover:bg-white/15">
        <Plus size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          {CREATABLE.map((k) => (
            <button key={k} type="button" onMouseDown={() => setKind(k)} className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">
              {OBJECTS[k].singular}
            </button>
          ))}
          <button type="button" onMouseDown={() => router.push("/tasks")} className="block w-full border-t border-stone-100 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">
            Task
          </button>
        </div>
      )}
      {kind && <CreateRecordDrawer key={kind} kind={kind} open onClose={() => setKind(null)} />}
    </div>
  );
}

function DialButton() {
  const { open } = useCall();
  return (
    <button type="button" aria-label="Make a call" title="Make a call" onClick={() => open()} className="hidden rounded-full p-2 text-white hover:bg-white/15 sm:block">
      <Phone size={18} strokeWidth={1.75} />
    </button>
  );
}

function AccountMenu() {
  const { me } = useData();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button type="button" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} onBlur={() => setTimeout(() => setOpen(false), 150)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm font-medium text-white hover:bg-white/15">
        <Avatar name={me.name} color={me.color} size={24} />
        <span className="hidden md:inline">{me.name}</span>
        <ChevronDown size={14} />
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
  return (
    <CallProvider>
      <Frame>{children}</Frame>
    </CallProvider>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { db } = useData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [slim, setSlim] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [more, setMore] = useState<string | null>(null);
  const unread = db.conversations.filter((c) => c.unread && c.status === "open").length;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const close = () => {
    setMobileOpen(false);
    setMore(null);
  };

  const link = (item: Item, compact: boolean) => (
    <Link
      key={item.href}
      href={item.href}
      title={compact ? item.label : undefined}
      onClick={close}
      className={cx("flex items-center gap-3 rounded-full py-2 text-[15px] text-white", compact ? "justify-center px-2" : "px-4", isActive(item.href) ? "bg-white/25 font-medium" : "hover:bg-white/10")}
    >
      <item.icon size={18} strokeWidth={1.75} className="shrink-0" />
      {!compact && <span className="truncate">{item.label}</span>}
    </Link>
  );

  const nav = (compact: boolean) => (
    <nav className={cx("flex h-full flex-col overflow-y-auto px-2 pb-3", CHROME)}>
      {link(I.home, compact)}
      <div className="mx-3 my-3 border-t border-white/30" />
      <div className="space-y-0.5">{PINNED.map((item) => link(item, compact))}</div>

      {GROUPS.map((group) => (
        <div key={group.label} className="mt-4">
          {!compact && (
            <button type="button" aria-expanded={!closed[group.label]} onClick={() => setClosed((c) => ({ ...c, [group.label]: !c[group.label] }))} className="flex w-full items-center gap-3 rounded-full px-4 py-1.5 text-left text-[15px] text-white/65 hover:text-white">
              {closed[group.label] ? <ChevronRight size={18} strokeWidth={1.75} /> : <ChevronDown size={18} strokeWidth={1.75} />}
              {group.label}
            </button>
          )}
          {(compact || !closed[group.label]) && <div className="space-y-0.5">{group.items.map((item) => link(item, compact))}</div>}
        </div>
      ))}

      <button
        type="button"
        aria-expanded={more !== null}
        onClick={() => setMore((m) => (m === null ? MORE[0].label : null))}
        title={compact ? "More" : undefined}
        className={cx("mt-4 flex items-center gap-3 rounded-full py-2 text-[15px] text-white", compact ? "justify-center px-2" : "px-4", more !== null ? "bg-white/25" : "hover:bg-white/10")}
      >
        <Ellipsis size={18} className="shrink-0" />
        {!compact && (
          <>
            <span className="flex-1 text-left">More</span>
            <ChevronRight size={16} />
          </>
        )}
      </button>

      <div className={cx("mt-auto flex pt-4", compact ? "justify-center" : "justify-end px-2")}>
        <button type="button" aria-label={compact ? "Expand sidebar" : "Collapse sidebar"} title={compact ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSlim((v) => !v)} className="hidden rounded p-1.5 text-white hover:bg-white/15 lg:block">
          <PanelLeft size={18} strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  );

  const current = MORE.find((g) => g.label === more);

  return (
    <div className={cx("flex h-screen flex-col", CHROME)}>
      <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 px-3">
        <button type="button" aria-label="Open menu" className="rounded p-1.5 text-white hover:bg-white/15 lg:hidden" onClick={() => setMobileOpen(true)}>
          <Menu size={20} />
        </button>
        <Link href="/" aria-label="Pipeline home" className={cx("flex shrink-0 items-center pl-2", slim ? "lg:w-10" : "lg:w-56")}>
          <LogoMark size={28} />
        </Link>
        <GlobalSearch />
        <div className="ml-auto flex items-center gap-1">
          <CreateMenu />
          <DialButton />
          <TopIcon href="/settings" label="Settings">
            <Settings size={18} strokeWidth={1.75} />
          </TopIcon>
          <TopIcon href="/inbox" label={unread ? `Inbox, ${unread} unread` : "Inbox"} badge={unread}>
            <Bell size={18} strokeWidth={1.75} />
          </TopIcon>
          <span className="mx-2 hidden h-6 border-l border-white/30 sm:block" />
          <AccountMenu />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={cx("hidden shrink-0 lg:block", slim ? "w-14" : "w-60")}>{nav(slim)}</aside>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={close}>
            <aside className={cx("h-full w-64 pt-3", CHROME)} onClick={(e) => e.stopPropagation()}>
              {nav(false)}
            </aside>
          </div>
        )}
        <main id="main" className="min-w-0 flex-1 overflow-y-auto bg-white px-4 py-6 lg:rounded-tl-2xl lg:px-8">
          {children}
        </main>
      </div>

      {current && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMore(null)} />
          <div className={cx("fixed bottom-4 z-50 flex h-[480px] max-h-[calc(100vh-88px)] overflow-hidden rounded-2xl text-white shadow-2xl", CHROME, mobileOpen ? "left-4" : slim ? "left-16" : "left-4 lg:left-[248px]")}>
            <ul className="w-52 overflow-y-auto border-r border-white/20 p-2">
              {MORE.map((g) => (
                <li key={g.label}>
                  <button type="button" onMouseEnter={() => setMore(g.label)} onClick={() => setMore(g.label)} className={cx("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[15px]", g.label === more ? "bg-white/20" : "hover:bg-white/10")}>
                    {g.label}
                    <ChevronRight size={15} />
                  </button>
                </li>
              ))}
            </ul>
            <ul className="w-56 overflow-y-auto p-2">
              {current.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={close} className={cx("flex items-center gap-3 rounded-lg px-3 py-2 text-[15px]", isActive(item.href) ? "bg-white/20" : "hover:bg-white/10")}>
                    <item.icon size={17} strokeWidth={1.75} />
                    {item.label}
                    {item.href === "/inbox" && unread > 0 && <span className="ml-auto rounded-full bg-rose-600 px-1.5 text-xs font-semibold">{unread}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
