"use client";

import { useState } from "react";
import type { Form } from "@/lib/types";
import { Button, inputCls } from "./ui";

/** The form as a visitor sees it. Used by the builder preview and the public page. */
export function FormView({ form, onSubmit }: { form: Form; onSubmit?: (values: Record<string, string>) => unknown }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (done)
    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-6 text-center text-sm font-medium text-emerald-800" role="status">
        {form.thanksMessage}
      </div>
    );

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!onSubmit) return;
        setBusy(true);
        setError("");
        try {
          await onSubmit(values);
          setDone(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">{form.headline}</h2>
        {form.description && <p className="mt-1 text-sm text-stone-600">{form.description}</p>}
      </div>
      {form.fields.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">
            {f.label}
            {f.required && <span className="text-rose-600"> *</span>}
          </span>
          {f.type === "textarea" ? (
            <textarea rows={3} className={inputCls} required={f.required} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          ) : (
            <input
              className={inputCls}
              type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
              required={f.required}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          )}
        </label>
      ))}
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? "Sending…" : form.submitText}
      </Button>
    </form>
  );
}
