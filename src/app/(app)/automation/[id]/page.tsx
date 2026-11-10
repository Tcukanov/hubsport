"use client";

import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/components/data";
import { Card, Empty, Field, Toggle, inputCls } from "@/components/ui";
import { PRIORITIES } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { displayName } from "@/lib/objects";
import type { WorkflowAction } from "@/lib/types";
import { ACTIONS, SETTABLE_FIELDS, TRIGGERS, describeAction, triggerValues } from "@/lib/workflow-config";

export default function WorkflowPage() {
  const { id } = useParams<{ id: string }>();
  const { db, update, mail } = useData();
  const wf = db.workflows.find((w) => w.id === id);

  if (!wf)
    return (
      <Empty title="Workflow not found">
        <Link href="/automation" className="text-sm text-teal-700 hover:underline">
          Back to automation
        </Link>
      </Empty>
    );

  const set = (patch: Record<string, unknown>) => update("workflows", id, patch);
  const setActions = (actions: WorkflowAction[]) => set({ actions });
  const patchAction = (i: number, patch: Partial<WorkflowAction>) => setActions(wf.actions.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...wf.actions];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setActions(next);
  };
  const trigger = TRIGGERS.find((t) => t.value === wf.trigger.type);
  const values = triggerValues(wf.trigger.type, db);
  const runs = db.workflowRuns.filter((r) => r.workflowId === id);
  const sendsEmail = wf.actions.some((a) => a.type === "send_email");

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/automation" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft size={15} />
        Automation
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          aria-label="Workflow name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight text-stone-900 outline-none hover:border-stone-300 focus:border-teal-500 focus:bg-white"
          value={wf.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <span className="text-sm text-stone-600">{wf.enabled ? "On" : "Off"}</span>
        <Toggle on={wf.enabled} label={`Turn workflow ${wf.enabled ? "off" : "on"}`} onChange={(v) => set({ enabled: v })} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <Card>
            <div className="space-y-3 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
                <Zap size={14} />
                Start when
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Trigger">
                  <select className={inputCls} value={wf.trigger.type} onChange={(e) => set({ trigger: { type: e.target.value, value: "" } })}>
                    {TRIGGERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {trigger?.valueLabel && (
                  <Field label={trigger.valueLabel}>
                    <select className={inputCls} value={wf.trigger.value} onChange={(e) => set({ trigger: { ...wf.trigger, value: e.target.value } })}>
                      <option value="">Any</option>
                      {values.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            </div>
          </Card>

          {wf.actions.map((a, i) => (
            <div key={i}>
              <div className="mx-auto h-4 w-px bg-stone-300" />
              <Card>
                <div className="space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">{i + 1}</span>
                    <p className="flex-1 text-sm font-semibold text-stone-900">{ACTIONS.find((x) => x.value === a.type)?.label}</p>
                    <button type="button" aria-label="Move action up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30">
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" aria-label="Move action down" disabled={i === wf.actions.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30">
                      <ArrowDown size={15} />
                    </button>
                    <button type="button" aria-label="Remove action" onClick={() => setActions(wf.actions.filter((_, k) => k !== i))} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-600">
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {a.type === "create_task" && (
                    <>
                      <Field label="Task title">
                        <input className={inputCls} value={a.title ?? ""} onChange={(e) => patchAction(i, { title: e.target.value })} />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Due in (days)">
                          <input type="number" min={0} className={inputCls} value={a.dueInDays ?? 0} onChange={(e) => patchAction(i, { dueInDays: Number(e.target.value) })} />
                        </Field>
                        <Field label="Priority">
                          <select className={inputCls} value={a.priority ?? "medium"} onChange={(e) => patchAction(i, { priority: e.target.value })}>
                            {PRIORITIES.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </>
                  )}

                  {a.type === "send_email" && (
                    <>
                      <Field label="Subject">
                        <input className={inputCls} value={a.subject ?? ""} onChange={(e) => patchAction(i, { subject: e.target.value })} />
                      </Field>
                      <Field label="Message">
                        <textarea rows={5} className={inputCls} value={a.body ?? ""} onChange={(e) => patchAction(i, { body: e.target.value })} />
                      </Field>
                    </>
                  )}

                  {a.type === "set_property" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Property">
                        <select className={inputCls} value={a.field ?? ""} onChange={(e) => patchAction(i, { field: e.target.value, value: SETTABLE_FIELDS.find((f) => f.value === e.target.value)?.options[0].value })}>
                          {SETTABLE_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="New value">
                        <select className={inputCls} value={a.value ?? ""} onChange={(e) => patchAction(i, { value: e.target.value })}>
                          {SETTABLE_FIELDS.find((f) => f.value === a.field)?.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}

                  {a.type === "add_note" && (
                    <Field label="Note">
                      <textarea rows={3} className={inputCls} value={a.body ?? ""} onChange={(e) => patchAction(i, { body: e.target.value })} />
                    </Field>
                  )}
                </div>
              </Card>
            </div>
          ))}

          <div className="mx-auto h-4 w-px bg-stone-300" />
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Add an action</p>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((x) => (
                <button key={x.value} type="button" onClick={() => setActions([...wf.actions, { ...x.blank }])} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50">
                  <Plus size={14} />
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-stone-500">
            Text fields accept <code className="rounded bg-stone-100 px-1">{"{{firstName}}"}</code>, <code className="rounded bg-stone-100 px-1">{"{{lastName}}"}</code> and <code className="rounded bg-stone-100 px-1">{"{{company}}"}</code>. Changes save automatically.
            Actions run on the contact involved (for deals, the first associated contact).
          </p>
          {sendsEmail && mail.driver !== "resend" && mail.driver !== "smtp" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {mail.driver === "outbox" ? "Development mode: emails from this workflow are saved to data/outbox instead of being delivered." : "Email sending is not set up on this deployment, so the email action will be logged as not sent."}
            </p>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Summary">
            <ol className="space-y-2 p-4 text-sm text-stone-700">
              <li>
                <span className="font-medium text-stone-900">When:</span> {trigger?.label}
                {wf.trigger.value ? ` (${values.find((v) => v.value === wf.trigger.value)?.label ?? wf.trigger.value})` : ""}
              </li>
              {wf.actions.map((a, i) => (
                <li key={i}>
                  <span className="font-medium text-stone-900">{i + 1}.</span> {describeAction(a)}
                </li>
              ))}
              {wf.actions.length === 0 && <li className="text-stone-500">No actions yet.</li>}
            </ol>
          </Card>
          <Card title={`Run history (${runs.length})`}>
            {runs.length === 0 ? (
              <p className="px-4 py-4 text-sm text-stone-500">This workflow has not run yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {runs.slice(0, 12).map((r) => {
                  const contact = db.contacts.find((c) => c.id === r.contactId);
                  return (
                    <li key={r.id} className="px-4 py-2.5 text-sm">
                      {contact ? (
                        <Link href={`/contacts/${contact.id}`} className="font-medium text-teal-700 hover:underline">
                          {displayName("contacts", contact)}
                        </Link>
                      ) : (
                        <span className="font-medium text-stone-700">No contact</span>
                      )}
                      <p className="text-stone-600">{r.summary}</p>
                      <p className="text-xs text-stone-400">{fmtDateTime(r.createdAt)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
