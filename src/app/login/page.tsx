"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { call } from "@/components/data";

export default function LoginPage() {
  const [hasUsers, setHasUsers] = useState(true);

  useEffect(() => {
    call<{ hasUsers: boolean; signedIn: boolean }>("auth/status")
      .then((s) => {
        if (s.signedIn) window.location.href = "/";
        else if (!s.hasUsers) window.location.href = "/signup";
        else setHasUsers(true);
      })
      .catch(() => undefined);
  }, []);

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back."
      submit="Sign in"
      fields={[
        { key: "email", label: "Email", type: "email", autoComplete: "email" },
        { key: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      onSubmit={(v) => call("auth/login", v)}
      footer={
        hasUsers ? (
          "New here? Ask a workspace admin to invite you."
        ) : (
          <Link href="/signup" className="text-violet-700 hover:underline">
            Create the workspace
          </Link>
        )
      }
    />
  );
}
