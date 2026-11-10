"use client";

import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { call } from "@/components/data";

/* Only the first person can sign up: they create the workspace and become
   its admin. Everyone after that joins through an invitation link. */
export default function SignupPage() {
  return (
    <AuthCard
      title="Create your workspace"
      subtitle="You will be the admin. The workspace starts with demo data you can reset or delete."
      submit="Create workspace"
      fields={[
        { key: "name", label: "Your name", autoComplete: "name" },
        { key: "email", label: "Email", type: "email", autoComplete: "email" },
        { key: "password", label: "Password (8+ characters)", type: "password", autoComplete: "new-password" },
      ]}
      onSubmit={(v) => call("auth/signup", v)}
      footer={
        <Link href="/login" className="text-teal-700 hover:underline">
          I already have an account
        </Link>
      }
    />
  );
}
