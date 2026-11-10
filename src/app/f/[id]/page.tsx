"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { call } from "@/components/data";
import { FormView } from "@/components/form-view";
import type { Form } from "@/lib/types";

/* The public page for a form. Visitors are not signed in, so it talks to the
   two public endpoints instead of the workspace API. */
export default function PublicFormPage() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    call<{ form: Form }>(`public/forms/${id}`)
      .then((r) => {
        setForm(r.form);
        setState("ready");
      })
      .catch(() => setState("missing"));
  }, [id]);

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        {state === "loading" && <p className="text-center text-sm text-stone-500">Loading…</p>}
        {state === "missing" && <p className="text-center text-sm text-stone-600">This form is not available.</p>}
        {form && <FormView form={form} onSubmit={(values) => call(`public/forms/${id}`, { values })} />}
      </div>
    </div>
  );
}
