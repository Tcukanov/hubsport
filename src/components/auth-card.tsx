"use client";

import { useState } from "react";
import { Logo } from "./logo";
import { Button, Field, inputCls } from "./ui";

export interface AuthField {
  key: string;
  label: string;
  type?: string;
  autoComplete?: string;
  value?: string;
  readOnly?: boolean;
}

/** The centred card shared by the sign-in, sign-up and invitation pages. */
export function AuthCard({
  title,
  subtitle,
  fields,
  submit,
  onSubmit,
  footer,
}: {
  title: string;
  subtitle?: string;
  fields: AuthField[];
  submit: string;
  onSubmit: (values: Record<string, string>) => Promise<unknown>;
  footer?: React.ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-900 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl">
        <div className="mb-5">
          <Logo />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
        <form
          className="mt-5 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await onSubmit(values);
              window.location.href = "/";
            } catch (err) {
              setError(err instanceof Error ? err.message : "Something went wrong.");
              setBusy(false);
            }
          }}
        >
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              <input
                className={inputCls}
                type={f.type ?? "text"}
                autoComplete={f.autoComplete}
                required
                readOnly={f.readOnly}
                value={f.value ?? values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            </Field>
          ))}
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? "One moment…" : submit}
          </Button>
        </form>
        {footer && <div className="mt-5 text-center text-sm text-stone-600">{footer}</div>}
      </div>
    </div>
  );
}
