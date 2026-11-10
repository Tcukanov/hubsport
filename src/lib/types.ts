/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyRec = { id: string; [key: string]: any };
export type Patch = Record<string, any>;

export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  role?: "admin" | "member";
  /** Sample teammate from the demo data: cannot sign in. */
  demo?: boolean;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  companyId: string | null;
  ownerId: string | null;
  lifecycleStage: string;
  leadStatus: string;
  city: string;
  country: string;
  source: string;
  subscribed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  industry: string;
  size: string;
  city: string;
  country: string;
  phone: string;
  annualRevenue: number | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  name: string;
  amount: number;
  stage: string;
  closeDate: string;
  ownerId: string | null;
  companyId: string | null;
  contactIds: string[];
  priority: string;
  dealType: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueDate: string;
  status: "open" | "done";
  ownerId: string | null;
  contactId: string | null;
  companyId: string | null;
  dealId: string | null;
  notes: string;
  createdAt: string;
  completedAt: string | null;
}

export interface Activity {
  id: string;
  type: string;
  subject?: string;
  body: string;
  contactId: string | null;
  companyId: string | null;
  dealId: string | null;
  userId: string | null;
  createdAt: string;
}

export interface SegmentFilter {
  field: string;
  op: string;
  value: string;
}

export interface Segment {
  id: string;
  name: string;
  match: "all" | "any";
  filters: SegmentFilter[];
  createdAt: string;
  updatedAt: string;
}

export interface FormField {
  key: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea";
  required: boolean;
}

export interface Form {
  id: string;
  name: string;
  status: "draft" | "published";
  headline: string;
  description: string;
  fields: FormField[];
  submitText: string;
  thanksMessage: string;
  lifecycleStage: string;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  formId: string;
  contactId: string | null;
  values: Record<string, string>;
  createdAt: string;
}

export interface MarketingEmail {
  id: string;
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  segmentId: string | null;
  status: "draft" | "sent";
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Send {
  id: string;
  emailId: string;
  contactId: string;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  /** Why the provider refused the message, when it did. */
  error?: string;
  createdAt: string;
}

export interface WorkflowAction {
  type: "create_task" | "set_property" | "send_email" | "add_note";
  /** create_task */
  title?: string;
  dueInDays?: number;
  priority?: string;
  /** set_property */
  field?: string;
  value?: string;
  /** send_email */
  subject?: string;
  /** send_email and add_note */
  body?: string;
}

export interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { type: string; value: string };
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  contactId: string | null;
  dealId: string | null;
  summary: string;
  createdAt: string;
}

/** An outreach email drafted by the prospecting agent, waiting for a person to review it. */
export interface Prospect {
  id: string;
  contactId: string;
  status: "draft" | "sent" | "dismissed";
  research: string;
  subject: string;
  body: string;
  generatedBy: "ai" | "template";
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
}

export interface DB {
  users: User[];
  contacts: Contact[];
  companies: Company[];
  deals: Deal[];
  tasks: Task[];
  activities: Activity[];
  segments: Segment[];
  forms: Form[];
  submissions: Submission[];
  emails: MarketingEmail[];
  sends: Send[];
  workflows: Workflow[];
  workflowRuns: WorkflowRun[];
  prospects: Prospect[];
}

export type CollectionName = keyof DB;

export const COLLECTIONS: CollectionName[] = [
  "users",
  "contacts",
  "companies",
  "deals",
  "tasks",
  "activities",
  "segments",
  "forms",
  "submissions",
  "emails",
  "sends",
  "workflows",
  "workflowRuns",
  "prospects",
];
