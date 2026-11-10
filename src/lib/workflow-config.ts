import { DEAL_STAGES, LEAD_STATUS, LIFECYCLE, type Option } from "./config";
import type { DB, Workflow, WorkflowAction } from "./types";

export const TRIGGERS: { value: string; label: string; valueLabel?: string }[] = [
  { value: "contact_created", label: "A contact is created" },
  { value: "form_submitted", label: "A form is submitted", valueLabel: "Which form" },
  { value: "lifecycle_changed", label: "A contact's lifecycle stage changes", valueLabel: "To which stage" },
  { value: "deal_created", label: "A deal is created", valueLabel: "In which stage" },
  { value: "deal_stage_changed", label: "A deal moves to a stage", valueLabel: "Which stage" },
];

export function triggerValues(type: string, db: DB): Option[] {
  if (type === "form_submitted") return db.forms.map((f) => ({ value: f.id, label: f.name }));
  if (type === "lifecycle_changed") return LIFECYCLE;
  if (type === "deal_created" || type === "deal_stage_changed") return DEAL_STAGES;
  return [];
}

export const ACTIONS: { value: WorkflowAction["type"]; label: string; blank: WorkflowAction }[] = [
  { value: "create_task", label: "Create a task", blank: { type: "create_task", title: "Follow up with {{firstName}} {{lastName}}", dueInDays: 1, priority: "medium" } },
  { value: "send_email", label: "Send an email", blank: { type: "send_email", subject: "Hello {{firstName}}", body: "Hi {{firstName}},\n\n" } },
  { value: "set_property", label: "Set a contact property", blank: { type: "set_property", field: "lifecycleStage", value: "mql" } },
  { value: "add_note", label: "Add a note", blank: { type: "add_note", body: "" } },
];

export const SETTABLE_FIELDS: { value: string; label: string; options: Option[] }[] = [
  { value: "lifecycleStage", label: "Lifecycle stage", options: LIFECYCLE },
  { value: "leadStatus", label: "Lead status", options: LEAD_STATUS },
  { value: "subscribed", label: "Subscribed to marketing", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] },
];

export function describeTrigger(w: Workflow, db: DB) {
  const t = TRIGGERS.find((x) => x.value === w.trigger.type);
  const v = triggerValues(w.trigger.type, db).find((o) => o.value === w.trigger.value);
  return `${t?.label ?? w.trigger.type}${v ? `: ${v.label}` : ""}`;
}

export function describeAction(a: WorkflowAction) {
  if (a.type === "create_task") return `Create task “${a.title}” due in ${a.dueInDays ?? 0} day(s)`;
  if (a.type === "send_email") return `Send email “${a.subject}”`;
  if (a.type === "set_property") {
    const f = SETTABLE_FIELDS.find((x) => x.value === a.field);
    return `Set ${f?.label ?? a.field} to ${f?.options.find((o) => o.value === a.value)?.label ?? a.value}`;
  }
  return "Add a note";
}
