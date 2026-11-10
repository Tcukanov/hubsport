"use client";

import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useData } from "@/components/data";
import { FormView } from "@/components/form-view";
import { Badge, Button, Card, Empty, Field, Tabs, inputCls } from "@/components/ui";
import { LIFECYCLE } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { displayName } from "@/lib/objects";
import type { FormField } from "@/lib/types";

const CATALOG: FormField[] = [
  { key: "firstName", label: "First name", type: "text", required: false },
  { key: "lastName", label: "Last name", type: "text", required: false },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "phone", required: false },
  { key: "jobTitle", label: "Job title", type: "text", required: false },
  { key: "city", label: "City", type: "text", required: false },
  { key: "message", label: "Message", type: "textarea", required: false },
];

export default function FormPage() {
  const { id } = useParams<{ id: string }>();
  const { db, update } = useData();
  const [tab, setTab] = useState<"build" | "submissions">("build");
  const form = db.forms.find((f) => f.id === id);

  if (!form)
    return (
      <Empty title="Form not found">
        <Link href="/forms" className="text-sm text-violet-700 hover:underline">
          Back to forms
        </Link>
      </Empty>
    );

  const set = (patch: Record<string, unknown>) => update("forms", id, patch);
  const setFields = (fields: FormField[]) => set({ fields });
  const submissions = db.submissions.filter((s) => s.formId === id);
  const published = form.status === "published";
  const move = (i: number, dir: -1 | 1) => {
    const next = [...form.fields];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setFields(next);
  };

  return (
    <div>
      <Link href="/forms" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft size={15} />
        Forms
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          aria-label="Form name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight text-stone-900 outline-none hover:border-stone-300 focus:border-violet-500 focus:bg-white"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <Badge tone={published ? "emerald" : "stone"}>{published ? "Published" : "Draft"}</Badge>
        {published && (
          <a href={`/f/${id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline">
            Open live form
            <ExternalLink size={14} />
          </a>
        )}
        <Button variant={published ? "secondary" : "primary"} onClick={() => set({ status: published ? "draft" : "published" })}>
          {published ? "Unpublish" : "Publish"}
        </Button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "build", label: "Build" },
          { value: "submissions", label: "Submissions", count: submissions.length },
        ]}
      />

      {tab === "build" ? (
        <div className="mt-4 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card title="Fields">
              <ul className="divide-y divide-stone-100">
                {CATALOG.map((item) => {
                  const i = form.fields.findIndex((f) => f.key === item.key);
                  const field = form.fields[i];
                  const locked = item.key === "email";
                  return (
                    <li key={item.key} className="space-y-2 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Include ${item.label}`}
                          className="h-4 w-4 accent-violet-600"
                          checked={!!field}
                          disabled={locked}
                          onChange={(e) => setFields(e.target.checked ? [...form.fields, item] : form.fields.filter((f) => f.key !== item.key))}
                        />
                        <span className="flex-1 text-sm font-medium text-stone-800">{item.label}</span>
                        {field && (
                          <>
                            <label className="flex items-center gap-1.5 text-xs text-stone-600">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-violet-600"
                                checked={field.required}
                                disabled={locked}
                                onChange={(e) => setFields(form.fields.map((f) => (f.key === item.key ? { ...f, required: e.target.checked } : f)))}
                              />
                              Required
                            </label>
                            <button type="button" aria-label={`Move ${item.label} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30">
                              <ArrowUp size={14} />
                            </button>
                            <button type="button" aria-label={`Move ${item.label} down`} disabled={i === form.fields.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30">
                              <ArrowDown size={14} />
                            </button>
                          </>
                        )}
                      </div>
                      {field && (
                        <input aria-label={`Label for ${item.label}`} className={inputCls} value={field.label} onChange={(e) => setFields(form.fields.map((f) => (f.key === item.key ? { ...f, label: e.target.value } : f)))} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Options">
              <div className="space-y-3 p-4">
                <Field label="Headline">
                  <input className={inputCls} value={form.headline} onChange={(e) => set({ headline: e.target.value })} />
                </Field>
                <Field label="Description">
                  <textarea rows={2} className={inputCls} value={form.description} onChange={(e) => set({ description: e.target.value })} />
                </Field>
                <Field label="Button text">
                  <input className={inputCls} value={form.submitText} onChange={(e) => set({ submitText: e.target.value })} />
                </Field>
                <Field label="Thank-you message">
                  <textarea rows={2} className={inputCls} value={form.thanksMessage} onChange={(e) => set({ thanksMessage: e.target.value })} />
                </Field>
                <Field label="Lifecycle stage for new contacts">
                  <select className={inputCls} value={form.lifecycleStage} onChange={(e) => set({ lifecycleStage: e.target.value })}>
                    {LIFECYCLE.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Card>
          </div>
          <Card title="Preview">
            <div className="bg-stone-100 p-6">
              <div className="mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-6">
                <FormView form={form} />
              </div>
              <p className="mt-3 text-center text-xs text-stone-500">Preview only. Publish the form and open the live link to submit it.</p>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="mt-4 overflow-x-auto">
          {submissions.length === 0 ? (
            <Empty title="No submissions yet" hint="Publish the form, open the live link and submit it to see entries here." />
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Submitted values</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {submissions.map((s) => {
                  const contact = db.contacts.find((c) => c.id === s.contactId);
                  return (
                    <tr key={s.id} className="align-top hover:bg-stone-50">
                      <td className="px-4 py-2.5 font-medium">
                        {contact ? (
                          <Link href={`/contacts/${contact.id}`} className="text-violet-700 hover:underline">
                            {displayName("contacts", contact)}
                          </Link>
                        ) : (
                          <span className="text-stone-400">Deleted contact</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-stone-700">
                        {Object.entries(s.values)
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <div key={k}>
                              <span className="text-stone-500">{CATALOG.find((c) => c.key === k)?.label ?? k}:</span> {v}
                            </div>
                          ))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-stone-600">{fmtDateTime(s.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
