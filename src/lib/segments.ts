import type { Company, Contact, Segment, SegmentFilter } from "./types";

export const SEGMENT_OPS: { value: string; label: string; noValue?: boolean }[] = [
  { value: "is", label: "is" },
  { value: "is_not", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "is_known", label: "is known", noValue: true },
  { value: "is_unknown", label: "is unknown", noValue: true },
  { value: "in_last_days", label: "is in the last (days)" },
  { value: "before", label: "is before (date)" },
  { value: "after", label: "is after (date)" },
];

function matchFilter(c: Contact, f: SegmentFilter) {
  const raw = (c as unknown as Record<string, unknown>)[f.field];
  const val = raw === null || raw === undefined ? "" : String(raw);
  const a = val.toLowerCase();
  const b = (f.value ?? "").toLowerCase().trim();
  switch (f.op) {
    case "is":
      return a === b;
    case "is_not":
      return a !== b;
    case "contains":
      return b !== "" && a.includes(b);
    case "not_contains":
      return !a.includes(b);
    case "starts_with":
      return b !== "" && a.startsWith(b);
    case "is_known":
      return val !== "";
    case "is_unknown":
      return val === "";
    case "in_last_days":
      return val !== "" && Date.now() - new Date(val).getTime() <= Number(b || 0) * 864e5;
    case "before":
      return val !== "" && b !== "" && new Date(val) < new Date(b);
    case "after":
      return val !== "" && b !== "" && new Date(val) > new Date(b);
    default:
      return false;
  }
}

export function segmentContacts(segment: Pick<Segment, "match" | "filters">, contacts: Contact[]) {
  if (!segment.filters.length) return contacts;
  return contacts.filter((c) =>
    segment.match === "any" ? segment.filters.some((f) => matchFilter(c, f)) : segment.filters.every((f) => matchFilter(c, f)),
  );
}

export function renderTokens(text: string, contact?: Contact | null, company?: Company | null) {
  return text
    .replaceAll("{{firstName}}", contact?.firstName || "there")
    .replaceAll("{{lastName}}", contact?.lastName || "")
    .replaceAll("{{company}}", company?.name || "your company");
}
