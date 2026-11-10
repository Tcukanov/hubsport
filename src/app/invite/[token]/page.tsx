"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { call } from "@/components/data";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [email, setEmail] = useState<string | null>(null);
  const [bad, setBad] = useState("");

  useEffect(() => {
    call<{ email: string }>(`invite/${token}`)
      .then((r) => setEmail(r.email))
      .catch((err) => setBad(err instanceof Error ? err.message : "This invitation is invalid."));
  }, [token]);

  if (bad)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-stone-700">{bad}</p>
        <Link href="/login" className="text-sm text-teal-700 hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  if (!email) return <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">Loading…</div>;

  return (
    <AuthCard
      title="Join the workspace"
      subtitle="Choose your name and a password to accept the invitation."
      submit="Join"
      fields={[
        { key: "email", label: "Email", type: "email", value: email, readOnly: true },
        { key: "name", label: "Your name", autoComplete: "name" },
        { key: "password", label: "Password (8+ characters)", type: "password", autoComplete: "new-password" },
      ]}
      onSubmit={(v) => call(`invite/${token}`, v)}
    />
  );
}
