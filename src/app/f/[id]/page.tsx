"use client";

import { useParams } from "next/navigation";
import { DataProvider, useData } from "@/components/data";
import { FormView } from "@/components/form-view";
import { submitForm } from "@/lib/mutations";

function PublicForm() {
  const { id } = useParams<{ id: string }>();
  const { db, mutate } = useData();
  const form = db.forms.find((f) => f.id === id);

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        {!form || form.status !== "published" ? (
          <p className="text-center text-sm text-stone-600">This form is not available.</p>
        ) : (
          <FormView form={form} onSubmit={(values) => mutate((d) => submitForm(d, form.id, values))} />
        )}
      </div>
    </div>
  );
}

export default function PublicFormPage() {
  return (
    <DataProvider>
      <PublicForm />
    </DataProvider>
  );
}
