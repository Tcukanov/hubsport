export interface Option {
  value: string;
  label: string;
  tone?: string;
}

export const LIFECYCLE: Option[] = [
  { value: "subscriber", label: "Subscriber", tone: "stone" },
  { value: "lead", label: "Lead", tone: "sky" },
  { value: "mql", label: "Marketing qualified", tone: "violet" },
  { value: "sql", label: "Sales qualified", tone: "amber" },
  { value: "opportunity", label: "Opportunity", tone: "orange" },
  { value: "customer", label: "Customer", tone: "emerald" },
];

export const LEAD_STATUS: Option[] = [
  { value: "new", label: "New", tone: "sky" },
  { value: "open", label: "Open", tone: "violet" },
  { value: "in_progress", label: "In progress", tone: "amber" },
  { value: "connected", label: "Connected", tone: "emerald" },
  { value: "unqualified", label: "Unqualified", tone: "stone" },
];

export const SOURCES: Option[] = [
  { value: "website", label: "Website" },
  { value: "form", label: "Form" },
  { value: "referral", label: "Referral" },
  { value: "event", label: "Event" },
  { value: "outbound", label: "Outbound" },
  { value: "ads", label: "Paid ads" },
];

export const DEAL_STAGES: (Option & { prob: number })[] = [
  { value: "lead_in", label: "Lead in", prob: 0.1, tone: "stone" },
  { value: "qualified", label: "Qualified", prob: 0.25, tone: "sky" },
  { value: "demo", label: "Demo", prob: 0.4, tone: "violet" },
  { value: "proposal", label: "Proposal", prob: 0.6, tone: "amber" },
  { value: "negotiation", label: "Negotiation", prob: 0.8, tone: "orange" },
  { value: "won", label: "Closed won", prob: 1, tone: "emerald" },
  { value: "lost", label: "Closed lost", prob: 0, tone: "rose" },
];

export const OPEN_STAGES = DEAL_STAGES.filter((s) => s.value !== "won" && s.value !== "lost").map((s) => s.value);

export const PRIORITIES: Option[] = [
  { value: "low", label: "Low", tone: "stone" },
  { value: "medium", label: "Medium", tone: "amber" },
  { value: "high", label: "High", tone: "rose" },
];

export const DEAL_TYPES: Option[] = [
  { value: "new", label: "New business" },
  { value: "existing", label: "Existing business" },
];

export const INDUSTRIES: Option[] = [
  "Software",
  "Hospitality",
  "Logistics",
  "Healthcare",
  "Education",
  "Retail",
  "Media",
  "Energy",
  "Design",
  "Fitness",
].map((v) => ({ value: v, label: v }));

export const SIZES: Option[] = ["1-10", "11-50", "51-200", "201-1000", "1000+"].map((v) => ({ value: v, label: v }));

export const TASK_TYPES: Option[] = [
  { value: "todo", label: "To-do" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
];

export const CALL_OUTCOMES = ["Connected", "Left voicemail", "No answer", "Wrong number"];

export const TICKET_STATUS: Option[] = [
  { value: "new", label: "New", tone: "sky" },
  { value: "waiting_contact", label: "Waiting on contact", tone: "amber" },
  { value: "waiting_us", label: "Waiting on us", tone: "orange" },
  { value: "closed", label: "Closed", tone: "emerald" },
];

export const TICKET_SOURCES: Option[] = [
  { value: "email", label: "Email" },
  { value: "chat", label: "Chat" },
  { value: "phone", label: "Phone" },
  { value: "form", label: "Form" },
];

export const ORDER_STATUS: Option[] = [
  { value: "pending", label: "Pending", tone: "amber" },
  { value: "paid", label: "Paid", tone: "sky" },
  { value: "fulfilled", label: "Fulfilled", tone: "emerald" },
  { value: "cancelled", label: "Cancelled", tone: "stone" },
  { value: "refunded", label: "Refunded", tone: "rose" },
];

export const BILLING: Option[] = [
  { value: "one_time", label: "One-time" },
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

export const TONES: Record<string, string> = {
  stone: "bg-stone-100 text-stone-700",
  sky: "bg-sky-100 text-sky-800",
  violet: "bg-teal-100 text-teal-800",
  amber: "bg-amber-100 text-amber-800",
  orange: "bg-orange-100 text-orange-800",
  emerald: "bg-emerald-100 text-emerald-800",
  rose: "bg-rose-100 text-rose-800",
};

export function optionLabel(options: Option[], value: string | null | undefined) {
  return options.find((o) => o.value === value)?.label ?? value ?? "";
}
