/* The automation engine. After something happens (an "event"), every enabled
   workflow whose trigger matches runs its actions in order. */
import { LEAD_STATUS, LIFECYCLE } from "../config";
import { createRecord, logActivity, newId, withMeta, type CrmEvent, type Meta } from "../mutations";
import { renderTokens } from "../segments";
import type { DB } from "../types";

export interface PendingEmail {
  contactId: string;
  to: string;
  subject: string;
  body: string;
  workflow: string;
}

const SETTABLE: Record<string, string[]> = {
  lifecycleStage: LIFECYCLE.map((o) => o.value),
  leadStatus: LEAD_STATUS.map((o) => o.value),
  subscribed: ["true", "false"],
};

/** Changes `db` and returns the emails that still have to be sent. Workflows never trigger other workflows. */
export function runWorkflows(db: DB, events: CrmEvent[], meta: Meta): PendingEmail[] {
  const emails: PendingEmail[] = [];
  const active = db.workflows.filter((w) => w.enabled);
  if (!events.length || !active.length) return emails;

  withMeta({ ...meta, seed: `${meta.seed}w`, userId: null }, () => {
    for (const event of events) {
      for (const wf of active) {
        if (wf.trigger.type !== event.type) continue;
        if (wf.trigger.value && wf.trigger.value !== event.value) continue;

        const deal = db.deals.find((d) => d.id === event.dealId);
        const contact = db.contacts.find((c) => c.id === (event.contactId ?? deal?.contactIds[0]));
        const company = db.companies.find((c) => c.id === (contact?.companyId ?? deal?.companyId));
        const fill = (s = "") => renderTokens(s, contact, company);
        const links = { contactId: contact?.id ?? null, companyId: company?.id ?? null, dealId: deal?.id ?? null };
        const done: string[] = [];

        for (const action of wf.actions) {
          if (action.type === "create_task") {
            const due = new Date(new Date(meta.now).getTime() + (Number(action.dueInDays) || 0) * 864e5).toISOString().slice(0, 10);
            createRecord(db, "tasks", {
              title: fill(action.title) || "Follow up",
              type: "todo",
              priority: action.priority || "medium",
              dueDate: due,
              status: "open",
              ownerId: contact?.ownerId ?? deal?.ownerId ?? null,
              notes: `Created by the workflow "${wf.name}"`,
              completedAt: null,
              ...links,
            });
            done.push("created a task");
          } else if (action.type === "set_property" && contact && action.field && SETTABLE[action.field]?.includes(action.value ?? "")) {
            const value = action.field === "subscribed" ? action.value === "true" : action.value;
            Object.assign(contact, { [action.field]: value, updatedAt: meta.now });
            done.push(`set ${action.field} to ${action.value}`);
          } else if (action.type === "add_note" && action.body) {
            logActivity(db, { type: "note", body: `${fill(action.body)}\n\n— workflow "${wf.name}"`, ...links });
            done.push("added a note");
          } else if (action.type === "send_email" && contact?.email) {
            emails.push({ contactId: contact.id, to: contact.email, subject: fill(action.subject) || "Hello", body: fill(action.body), workflow: wf.name });
            done.push("queued an email");
          }
        }

        db.workflowRuns.unshift({
          id: newId("workflowRuns"),
          workflowId: wf.id,
          contactId: links.contactId,
          dealId: links.dealId,
          summary: done.length ? done.join(", ") : "nothing to do",
          createdAt: meta.now,
        });
      }
    }
    db.workflowRuns = db.workflowRuns.slice(0, 300);
  });

  return emails;
}
