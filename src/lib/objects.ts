import { DEAL_STAGES, DEAL_TYPES, INDUSTRIES, LEAD_STATUS, LIFECYCLE, PRIORITIES, SIZES, SOURCES, type Option } from "./config";
import { addDays } from "./format";
import type { AnyRec, Patch } from "./types";

export type ObjectKind = "contacts" | "companies" | "deals";
export type PropType = "text" | "email" | "phone" | "number" | "money" | "date" | "select" | "user" | "company" | "bool";

export interface PropDef {
  key: string;
  label: string;
  type: PropType;
  options?: Option[];
  filter?: boolean;
  readOnly?: boolean;
}

export interface ObjectCfg {
  singular: string;
  plural: string;
  path: string;
  props: PropDef[];
  columns: string[];
  createKeys: string[];
  defaults: () => Patch;
}

const owner: PropDef = { key: "ownerId", label: "Owner", type: "user", filter: true };
const created: PropDef = { key: "createdAt", label: "Created", type: "date", readOnly: true };
const company: PropDef = { key: "companyId", label: "Company", type: "company" };

export const OBJECTS: Record<ObjectKind, ObjectCfg> = {
  contacts: {
    singular: "Contact",
    plural: "Contacts",
    path: "/contacts",
    props: [
      { key: "firstName", label: "First name", type: "text" },
      { key: "lastName", label: "Last name", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "phone" },
      { key: "jobTitle", label: "Job title", type: "text" },
      company,
      { key: "lifecycleStage", label: "Lifecycle stage", type: "select", options: LIFECYCLE, filter: true },
      { key: "leadStatus", label: "Lead status", type: "select", options: LEAD_STATUS, filter: true },
      owner,
      { key: "city", label: "City", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "source", label: "Original source", type: "select", options: SOURCES },
      { key: "subscribed", label: "Subscribed to marketing", type: "bool" },
      created,
    ],
    columns: ["email", "phone", "companyId", "lifecycleStage", "leadStatus", "ownerId", "createdAt"],
    createKeys: ["firstName", "lastName", "email", "phone", "jobTitle", "companyId", "lifecycleStage", "leadStatus", "ownerId"],
    defaults: () => ({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      jobTitle: "",
      companyId: null,
      ownerId: "u_1",
      lifecycleStage: "lead",
      leadStatus: "new",
      city: "",
      country: "",
      source: "outbound",
      subscribed: true,
    }),
  },
  companies: {
    singular: "Company",
    plural: "Companies",
    path: "/companies",
    props: [
      { key: "name", label: "Company name", type: "text" },
      { key: "domain", label: "Domain", type: "text" },
      { key: "industry", label: "Industry", type: "select", options: INDUSTRIES, filter: true },
      { key: "size", label: "Employees", type: "select", options: SIZES },
      { key: "annualRevenue", label: "Annual revenue", type: "money" },
      { key: "phone", label: "Phone", type: "phone" },
      { key: "city", label: "City", type: "text" },
      { key: "country", label: "Country", type: "text" },
      owner,
      created,
    ],
    columns: ["domain", "industry", "size", "city", "ownerId", "createdAt"],
    createKeys: ["name", "domain", "industry", "size", "city", "country", "ownerId"],
    defaults: () => ({ name: "", domain: "", industry: "Software", size: "11-50", annualRevenue: null, phone: "", city: "", country: "", ownerId: "u_1" }),
  },
  deals: {
    singular: "Deal",
    plural: "Deals",
    path: "/deals",
    props: [
      { key: "name", label: "Deal name", type: "text" },
      { key: "amount", label: "Amount", type: "money" },
      { key: "stage", label: "Deal stage", type: "select", options: DEAL_STAGES, filter: true },
      { key: "closeDate", label: "Close date", type: "date" },
      owner,
      company,
      { key: "priority", label: "Priority", type: "select", options: PRIORITIES },
      { key: "dealType", label: "Deal type", type: "select", options: DEAL_TYPES },
      created,
    ],
    columns: ["stage", "amount", "closeDate", "companyId", "ownerId", "priority"],
    createKeys: ["name", "amount", "stage", "closeDate", "companyId", "ownerId", "priority"],
    defaults: () => ({ name: "", amount: 0, stage: "lead_in", closeDate: addDays(30), ownerId: "u_1", companyId: null, contactIds: [], priority: "medium", dealType: "new" }),
  },
};

export function displayName(kind: ObjectKind, rec: AnyRec | null | undefined) {
  if (!rec) return "";
  if (kind === "contacts") return `${rec.firstName ?? ""} ${rec.lastName ?? ""}`.trim() || rec.email || "Unnamed contact";
  return rec.name || `Unnamed ${OBJECTS[kind].singular.toLowerCase()}`;
}
