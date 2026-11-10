import type { Activity, Company, Contact, Conversation, DB, Deal, LineItem, Message, Order, Product, Send, Submission, Task, Ticket, User } from "./types";
import { defaultProfile } from "./booking";
import { ymd } from "./format";

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Maya", "Liam", "Sofia", "Noah", "Ava", "Ethan", "Zoe", "Lucas", "Mia", "Owen", "Layla", "Caleb", "Nora", "Felix", "Iris", "Jonah", "Priya", "Mateo", "Hana", "Theo", "Amara", "Diego", "Elena", "Kofi", "Ines", "Ravi", "Tessa", "Omar", "Greta", "Jude"];
const LAST = ["Bennett", "Okafor", "Lindqvist", "Marsh", "Castillo", "Nakamura", "Hale", "Petrov", "Quinn", "Adeyemi", "Fontaine", "Brooks", "Kaur", "Novak", "Sato", "Delgado", "Whitlock", "Moreau", "Ibarra", "Holt"];
const TITLES = ["Operations Manager", "Head of Marketing", "Founder", "Sales Director", "Office Manager", "CTO", "Procurement Lead", "Events Coordinator", "Finance Manager", "Product Manager"];

const COMPANY_SEED: [string, string, string, string, string][] = [
  ["Northshore Kayaks", "northshorekayaks.example", "Retail", "Portland", "United States"],
  ["Brightline Logistics", "brightline.example", "Logistics", "Chicago", "United States"],
  ["Copperleaf Studio", "copperleaf.example", "Design", "Austin", "United States"],
  ["Harbor & Pine", "harborpine.example", "Hospitality", "Seattle", "United States"],
  ["Lumen Dental", "lumendental.example", "Healthcare", "Denver", "United States"],
  ["Quarry Coffee Roasters", "quarrycoffee.example", "Retail", "Toronto", "Canada"],
  ["Tidewater Analytics", "tidewater.example", "Software", "Boston", "United States"],
  ["Fennel Health", "fennelhealth.example", "Healthcare", "London", "United Kingdom"],
  ["Atlas Robotics", "atlasrobotics.example", "Software", "Berlin", "Germany"],
  ["Marigold Events", "marigoldevents.example", "Hospitality", "New York", "United States"],
  ["Slate Architecture", "slatearch.example", "Design", "Amsterdam", "Netherlands"],
  ["Juniper Schools", "juniperschools.example", "Education", "Dublin", "Ireland"],
  ["Peakline Fitness", "peakline.example", "Fitness", "Vancouver", "Canada"],
  ["Orchard Software", "orchardsoft.example", "Software", "San Francisco", "United States"],
  ["Cobalt Freight", "cobaltfreight.example", "Logistics", "Rotterdam", "Netherlands"],
  ["Sable Hotels", "sablehotels.example", "Hospitality", "Lisbon", "Portugal"],
  ["Wren Media", "wrenmedia.example", "Media", "Los Angeles", "United States"],
  ["Kestrel Energy", "kestrelenergy.example", "Energy", "Houston", "United States"],
];

const NOTES = [
  "Great intro call. They are comparing two vendors and want pricing by end of week.",
  "Asked for a case study from a similar-sized team. Sending the hospitality one.",
  "Budget is approved for next quarter. Decision maker joins the next call.",
  "Main concern is onboarding time. Walked through the two-week rollout plan.",
  "Prefers email over phone. Follow up after their board meeting.",
  "Interested in the team licence. Needs legal to review the contract terms.",
];
const SUBJECTS = ["Following up on our call", "Pricing overview", "Quick question about your rollout", "Next steps", "Case study you asked for"];
const PRODUCTS = ["Annual plan", "Pilot", "Expansion", "Renewal", "Onboarding package", "Team licence"];
const STAGES = ["lead_in", "lead_in", "qualified", "qualified", "demo", "demo", "proposal", "proposal", "negotiation", "won", "won", "won", "won", "lost", "lost"];

/** Demo data for a new workspace. `me` is the person who just signed up. */
export function buildSeed(me: User): DB {
  const r = rng(42);
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
  const int = (min: number, max: number) => Math.floor(min + r() * (max - min + 1));
  const now = Date.now();
  const ago = (days: number) => new Date(now - days * 864e5).toISOString();
  const day = (offset: number) => ymd(new Date(now + offset * 864e5));

  const users: User[] = [
    me,
    { id: "u_demo2", name: "Jamie Osei", email: "jamie@pipeline.example", color: "#0d9488", demo: true },
    { id: "u_demo3", name: "Robin Vega", email: "robin@pipeline.example", color: "#d97706", demo: true },
    { id: "u_demo4", name: "Sasha Lind", email: "sasha@pipeline.example", color: "#db2777", demo: true },
  ];
  const owner = () => pick(users).id;

  const companies: Company[] = COMPANY_SEED.map(([name, domain, industry, city, country], i) => {
    const created = ago(int(40, 300));
    return {
      id: `co_${i + 1}`,
      name,
      domain,
      industry,
      size: pick(["1-10", "11-50", "51-200", "201-1000", "1000+"]),
      city,
      country,
      phone: `+1 555 01${String(10 + i).padStart(2, "0")}`,
      annualRevenue: int(5, 400) * 100000,
      ownerId: owner(),
      createdAt: created,
      updatedAt: created,
    };
  });

  const lifecycle = ["subscriber", "lead", "lead", "lead", "mql", "mql", "sql", "opportunity", "customer", "customer"];
  const contacts: Contact[] = Array.from({ length: 60 }, (_, i) => {
    const firstName = FIRST[i % FIRST.length];
    const lastName = LAST[(i * 7 + 3) % LAST.length];
    const company = r() < 0.85 ? companies[i % companies.length] : null;
    const created = ago(int(0, 180));
    const stage = pick(lifecycle);
    return {
      id: `c_${i + 1}`,
      firstName,
      lastName,
      email: `${firstName}.${lastName}@${company?.domain ?? "mail.example"}`.toLowerCase(),
      phone: `+1 555 02${String(i).padStart(2, "0")}`,
      jobTitle: pick(TITLES),
      companyId: company?.id ?? null,
      ownerId: owner(),
      lifecycleStage: stage,
      leadStatus: stage === "customer" ? "connected" : pick(["new", "open", "in_progress", "connected", "unqualified"]),
      city: company?.city ?? pick(["Miami", "Madrid", "Oslo"]),
      country: company?.country ?? "United States",
      source: pick(["website", "form", "referral", "event", "outbound", "ads"]),
      subscribed: r() < 0.8,
      createdAt: created,
      updatedAt: created,
    };
  });

  const deals: Deal[] = Array.from({ length: 28 }, (_, i) => {
    const company = companies[(i * 5 + 2) % companies.length];
    const stage = STAGES[i % STAGES.length];
    const closed = stage === "won" || stage === "lost";
    const created = ago(int(closed ? 30 : 5, closed ? 200 : 60));
    return {
      id: `d_${i + 1}`,
      name: `${company.name} — ${pick(PRODUCTS)}`,
      amount: int(2, 60) * 1000,
      stage,
      closeDate: closed ? day(-int(1, 150)) : day(int(4, 60)),
      ownerId: owner(),
      companyId: company.id,
      contactIds: contacts.filter((c) => c.companyId === company.id).slice(0, int(1, 2)).map((c) => c.id),
      priority: pick(["low", "medium", "medium", "high"]),
      dealType: pick(["new", "new", "existing"]),
      createdAt: created,
      updatedAt: created,
    };
  });

  const activities: Activity[] = [];
  let an = 0;
  const log = (a: Partial<Activity> & { type: string; body: string; createdAt: string }) =>
    activities.push({ id: `a_${++an}`, contactId: null, companyId: null, dealId: null, userId: owner(), ...a });

  contacts.forEach((c) => {
    log({ type: "created", body: "Contact created", contactId: c.id, companyId: c.companyId, createdAt: c.createdAt });
    const n = int(0, 3);
    for (let k = 0; k < n; k++) {
      const type = pick(["note", "call", "email", "meeting"]);
      const createdAt = ago(r() * 45);
      if (new Date(createdAt) < new Date(c.createdAt)) continue;
      log({
        type,
        subject: type === "email" ? pick(SUBJECTS) : type === "meeting" ? "Discovery meeting" : type === "call" ? pick(["Connected", "Left voicemail", "No answer"]) : undefined,
        body: pick(NOTES),
        contactId: c.id,
        companyId: c.companyId,
        createdAt,
      });
    }
  });
  deals.forEach((d) => {
    log({ type: "created", body: "Deal created", dealId: d.id, companyId: d.companyId, createdAt: d.createdAt });
    if (r() < 0.6) log({ type: "note", body: pick(NOTES), dealId: d.id, companyId: d.companyId, createdAt: ago(r() * 20) });
  });

  const taskTitles = ["Follow up with", "Send proposal to", "Schedule demo with", "Check in with", "Send contract to", "Call"];
  const tasks: Task[] = Array.from({ length: 18 }, (_, i) => {
    const c = contacts[(i * 3 + 1) % contacts.length];
    const done = i % 5 === 4;
    const title = pick(taskTitles);
    return {
      id: `t_${i + 1}`,
      title: `${title} ${c.firstName} ${c.lastName}`,
      type: title === "Call" ? "call" : title.startsWith("Send") ? "email" : "todo",
      priority: pick(["low", "medium", "high"]),
      dueDate: day(i < 4 ? 0 : int(-4, 12)),
      status: done ? "done" : "open",
      ownerId: i < 8 ? me.id : owner(),
      contactId: c.id,
      companyId: c.companyId,
      dealId: null,
      notes: "",
      createdAt: ago(int(1, 14)),
      completedAt: done ? ago(1) : null,
    };
  });

  const segments = [
    { id: "s_1", name: "Customers", match: "all" as const, filters: [{ field: "lifecycleStage", op: "is", value: "customer" }], createdAt: ago(90), updatedAt: ago(90) },
    { id: "s_2", name: "Newsletter subscribers", match: "all" as const, filters: [{ field: "subscribed", op: "is", value: "true" }], createdAt: ago(80), updatedAt: ago(80) },
    { id: "s_3", name: "New leads (last 30 days)", match: "all" as const, filters: [{ field: "lifecycleStage", op: "is", value: "lead" }, { field: "createdAt", op: "in_last_days", value: "30" }], createdAt: ago(20), updatedAt: ago(20) },
    { id: "s_4", name: "Hospitality or events contacts", match: "any" as const, filters: [{ field: "jobTitle", op: "contains", value: "Events" }, { field: "email", op: "contains", value: "hotel" }], createdAt: ago(10), updatedAt: ago(10) },
  ];

  const forms = [
    {
      id: "f_1",
      name: "Newsletter signup",
      status: "published" as const,
      headline: "Get our monthly newsletter",
      description: "Product news and practical tips, once a month.",
      fields: [
        { key: "firstName", label: "First name", type: "text" as const, required: false },
        { key: "email", label: "Email", type: "email" as const, required: true },
      ],
      submitText: "Subscribe",
      thanksMessage: "Thanks for subscribing! Look out for the next issue.",
      lifecycleStage: "subscriber",
      createdAt: ago(120),
      updatedAt: ago(30),
    },
    {
      id: "f_2",
      name: "Request a demo",
      status: "published" as const,
      headline: "Book a 20-minute demo",
      description: "Tell us a little about your team and we will be in touch within one business day.",
      fields: [
        { key: "firstName", label: "First name", type: "text" as const, required: true },
        { key: "lastName", label: "Last name", type: "text" as const, required: true },
        { key: "email", label: "Work email", type: "email" as const, required: true },
        { key: "phone", label: "Phone", type: "phone" as const, required: false },
        { key: "message", label: "What would you like to see?", type: "textarea" as const, required: false },
      ],
      submitText: "Request demo",
      thanksMessage: "Thanks! We will reach out shortly to find a time.",
      lifecycleStage: "lead",
      createdAt: ago(100),
      updatedAt: ago(12),
    },
  ];

  const submissions: Submission[] = [];
  contacts
    .filter((c) => c.source === "form")
    .forEach((c, i) => {
      const form = forms[i % 2];
      submissions.push({
        id: `sub_${i + 1}`,
        formId: form.id,
        contactId: c.id,
        values: { firstName: c.firstName, lastName: c.lastName, email: c.email },
        createdAt: c.createdAt,
      });
      log({ type: "form_submission", body: `Submitted the form "${form.name}"`, contactId: c.id, companyId: c.companyId, userId: null, createdAt: c.createdAt });
    });

  const baseEmail = { fromName: `${me.name.split(" ")[0]} at Pipeline`, fromEmail: me.email, ctaUrl: "https://example.com" };
  const emails = [
    {
      ...baseEmail,
      id: "e_1",
      name: "October product update",
      subject: "What's new this month, {{firstName}}",
      previewText: "Three improvements you asked for.",
      body: "Hi {{firstName}},\n\nWe shipped three things this month: faster reporting, a cleaner deal board, and shared task lists.\n\nEverything is live in your account today. Reply to this email if you want a walkthrough.",
      ctaLabel: "See what's new",
      segmentId: "s_2",
      status: "sent" as const,
      sentAt: ago(21),
      createdAt: ago(24),
      updatedAt: ago(21),
    },
    {
      ...baseEmail,
      id: "e_2",
      name: "Customer check-in",
      subject: "How is everything going at {{company}}?",
      previewText: "A two-minute survey.",
      body: "Hi {{firstName}},\n\nYou have been with us for a while now, and we would love to hear how things are going.\n\nThe survey takes two minutes and goes straight to the product team.",
      ctaLabel: "Take the survey",
      segmentId: "s_1",
      status: "sent" as const,
      sentAt: ago(8),
      createdAt: ago(10),
      updatedAt: ago(8),
    },
    {
      ...baseEmail,
      id: "e_3",
      name: "Winter offer",
      subject: "A winter offer for new teams",
      previewText: "Two months free on annual plans.",
      body: "Hi {{firstName}},\n\nIf you have been thinking about getting started, this is a good moment: annual plans come with two months free until the end of the year.",
      ctaLabel: "Claim the offer",
      segmentId: "s_3",
      status: "draft" as const,
      sentAt: null,
      createdAt: ago(2),
      updatedAt: ago(2),
    },
  ];

  const sends: Send[] = [];
  let sn = 0;
  const sendTo = (emailId: string, list: Contact[], at: string, name: string) =>
    list.forEach((c) => {
      const delivered = r() > 0.03;
      const opened = delivered && r() < 0.48;
      sends.push({ id: `sd_${++sn}`, emailId, contactId: c.id, delivered, opened, clicked: opened && r() < 0.3, createdAt: at });
      log({ type: "marketing_email", subject: name, body: `Was sent the marketing email "${name}"`, contactId: c.id, companyId: c.companyId, userId: null, createdAt: at });
    });
  sendTo("e_1", contacts.filter((c) => c.subscribed && new Date(c.createdAt) < new Date(ago(21))), ago(21), "October product update");
  sendTo("e_2", contacts.filter((c) => c.subscribed && c.lifecycleStage === "customer" && new Date(c.createdAt) < new Date(ago(8))), ago(8), "Customer check-in");

  const products: Product[] = (
    [
      ["Starter plan", "PLAN-START", 490, "annual", "Up to 5 users, core CRM."],
      ["Team plan", "PLAN-TEAM", 1900, "annual", "Up to 25 users, automation included."],
      ["Enterprise plan", "PLAN-ENT", 9600, "annual", "Unlimited users, priority support."],
      ["Onboarding package", "SVC-ONB", 1500, "one_time", "Guided setup and data import."],
      ["Training workshop", "SVC-TRAIN", 800, "one_time", "Half-day live session for the team."],
      ["Premium support", "SUP-PREM", 150, "monthly", "Four-hour response time."],
    ] as [string, string, number, string, string][]
  ).map(([name, sku, price, billing, description], i) => ({ id: `pr_${i + 1}`, name, sku, price, billing, description, active: true, createdAt: ago(200), updatedAt: ago(200) }));

  const pickItems = (): LineItem[] => {
    const first = pick(products.slice(0, 3));
    const items: LineItem[] = [{ productId: first.id, name: first.name, quantity: int(1, 3), price: first.price }];
    if (r() < 0.6) {
      const extra = pick(products.slice(3));
      items.push({ productId: extra.id, name: extra.name, quantity: extra.billing === "monthly" ? 12 : 1, price: extra.price });
    }
    return items;
  };
  deals.forEach((d, i) => {
    if (i % 3 === 0) d.lineItems = pickItems();
  });

  const TICKETS = ["Cannot import contacts from CSV", "Invoice shows the wrong billing address", "How do I add a second pipeline?", "Password reset email not arriving", "Dashboard totals look off", "Request: export deals to a spreadsheet", "Email tracking is not recording opens", "Need help setting up a form", "User cannot see assigned tasks", "Question about upgrading our plan", "Duplicate contacts after import", "Workflow did not send its email"];
  const ticketStatus = ["new", "new", "waiting_us", "waiting_contact", "waiting_us", "closed", "closed", "new", "waiting_contact", "closed", "waiting_us", "new"];
  const customers = contacts.filter((c) => c.lifecycleStage === "customer" || c.lifecycleStage === "opportunity");
  const tickets: Ticket[] = TICKETS.map((name, i) => {
    const c = customers[i % customers.length];
    const created = ago(int(0, 25));
    const status = ticketStatus[i];
    log({ type: "created", body: "Ticket created", ticketId: `tk_${i + 1}`, contactId: c.id, companyId: c.companyId, createdAt: created });
    return {
      id: `tk_${i + 1}`,
      name,
      description: "Reported by the customer. See the timeline for the conversation so far.",
      status,
      priority: pick(["low", "medium", "medium", "high"]),
      source: pick(["email", "chat", "phone", "form"]),
      contactId: c.id,
      companyId: c.companyId,
      ownerId: i < 5 ? me.id : owner(),
      createdAt: created,
      updatedAt: created,
      closedAt: status === "closed" ? created : null,
    };
  });

  const orderStatus = ["paid", "fulfilled", "fulfilled", "pending", "paid", "fulfilled", "refunded", "pending", "fulfilled", "cancelled"];
  const orders: Order[] = orderStatus.map((status, i) => {
    const c = customers[(i * 2 + 1) % customers.length];
    const lineItems = pickItems();
    const created = ago(int(1, 90));
    return {
      id: `o_${i + 1}`,
      name: `Order #${1001 + i}`,
      status,
      amount: lineItems.reduce((sum, li) => sum + li.quantity * li.price, 0),
      orderDate: created.slice(0, 10),
      lineItems,
      contactId: c.id,
      companyId: c.companyId,
      ownerId: owner(),
      createdAt: created,
      updatedAt: created,
    };
  });

  const THREADS: [string, string, string[]][] = [
    ["Question about the Team plan", "open", ["Hi, does the Team plan include automation, or is that an add-on?", "<Automation is included in Team. I can show you in a quick call if useful.", "That would be great. Is Thursday afternoon possible?"]],
    ["Invoice for October", "open", ["Could you resend the October invoice with our new billing address?"]],
    ["Trouble importing contacts", "open", ["The CSV import stops at row 200 with an error.", "<Thanks for the report. Can you send the file so we can reproduce it?", "!Looks like the date column. Asked them for the file.", "Attached. It is the export from our old system."]],
    ["Thanks for the demo", "closed", ["Thanks for the walkthrough yesterday, very helpful.", "<Glad it was useful. I will follow up with pricing next week."]],
    ["Adding more users", "open", ["We would like to add five more seats. How do we do that?"]],
  ];
  const conversations: Conversation[] = [];
  const messages: Message[] = [];
  THREADS.forEach(([subject, status, lines], i) => {
    const c = customers[(i * 3 + 2) % customers.length];
    const start = int(1, 9) + lines.length;
    lines.forEach((line, k) => {
      const direction = line.startsWith("<") ? "out" : line.startsWith("!") ? "note" : "in";
      messages.push({ id: `m_${i + 1}_${k}`, conversationId: `cv_${i + 1}`, direction, body: line.replace(/^[<!]/, ""), userId: direction === "in" ? null : me.id, createdAt: ago(start - k - 0.5) });
    });
    const last = messages[messages.length - 1];
    conversations.push({ id: `cv_${i + 1}`, contactId: c.id, subject, channel: "email", status: status as Conversation["status"], assigneeId: i % 2 ? null : me.id, ticketId: null, unread: last.direction === "in" && status === "open", lastMessageAt: last.createdAt, createdAt: ago(start), updatedAt: last.createdAt });
  });

  const workflows = [
    {
      id: "w_1",
      name: "Demo request follow-up",
      enabled: true,
      trigger: { type: "form_submitted", value: "f_2" },
      actions: [
        { type: "set_property" as const, field: "lifecycleStage", value: "mql" },
        { type: "create_task" as const, title: "Call {{firstName}} {{lastName}} about their demo request", dueInDays: 1, priority: "high" },
        { type: "send_email" as const, subject: "Thanks for your interest, {{firstName}}", body: "Hi {{firstName}},\n\nThanks for requesting a demo. Someone from our team will call you within one business day to find a time.\n\nTalk soon." },
      ],
      createdAt: ago(60),
      updatedAt: ago(60),
    },
    {
      id: "w_2",
      name: "Won deal handover",
      enabled: true,
      trigger: { type: "deal_stage_changed", value: "won" },
      actions: [
        { type: "set_property" as const, field: "lifecycleStage", value: "customer" },
        { type: "create_task" as const, title: "Schedule onboarding kickoff for {{company}}", dueInDays: 3, priority: "medium" },
        { type: "add_note" as const, body: "Deal closed won. Handover to onboarding started automatically." },
      ],
      createdAt: ago(45),
      updatedAt: ago(45),
    },
    {
      id: "w_3",
      name: "Welcome new subscribers",
      enabled: false,
      trigger: { type: "form_submitted", value: "f_1" },
      actions: [{ type: "send_email" as const, subject: "Welcome aboard, {{firstName}}", body: "Hi {{firstName}},\n\nThanks for subscribing. You will hear from us about once a month." }],
      createdAt: ago(30),
      updatedAt: ago(30),
    },
  ];

  return { users, contacts, companies, deals, tasks, activities, segments, forms, submissions, emails, sends, workflows, workflowRuns: [], prospects: [], tickets, products, orders, conversations, messages, profiles: [defaultProfile(me)], bookings: [] };
}
