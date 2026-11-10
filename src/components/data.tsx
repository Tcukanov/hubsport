"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { applyOp, newMeta, type Meta, type Op } from "@/lib/mutations";
import type { Activity, AnyRec, CollectionName, DB, Patch, User } from "@/lib/types";

/* The browser keeps a copy of the CRM data. An edit is applied to that copy
   straight away (so the screen never waits) and sent to the server as an
   "operation", which applies the very same change to the real database. */

interface Info {
  meId: string;
  storage: "postgres" | "file";
  mail: { driver: "resend" | "smtp" | "outbox" | "none"; from: string };
  ai: boolean;
  /** Webhook address for incoming email. Only sent to admins. */
  inboundUrl: string | null;
}

interface DataCtx extends Info {
  db: DB;
  me: User;
  create: (c: CollectionName, data: Patch) => AnyRec;
  update: (c: CollectionName, id: string, patch: Patch) => void;
  remove: (c: CollectionName, id: string) => void;
  removeMany: (c: CollectionName, ids: string[]) => void;
  log: (activity: Partial<Activity> & { type: string; body: string }) => void;
  /** Call a server endpoint (e.g. sending an email), then reload the data. Throws an Error with a readable message. */
  api: <T = Record<string, unknown>>(path: string, body?: unknown, method?: string) => Promise<T>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);

export async function call<T = Record<string, unknown>>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data as T;
}

/** Fields whose change also writes a timeline entry: such updates are never merged with others. */
const LOGGED_FIELDS = ["stage", "lifecycleStage", "status"];
const plain = (op: Op) => op.t === "update" && !LOGGED_FIELDS.some((k) => k in op.patch);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [db, setDb] = useState<DB | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const local = useRef<DB | null>(null);
  const queue = useRef<{ op: Op; meta: Meta }[]>([]);
  const working = useRef<Promise<void> | null>(null);
  const edits = useRef(0);

  const refresh = useCallback(async () => {
    if (working.current) await working.current;
    const seen = edits.current;
    try {
      const data = await call<Info & { db: DB }>("workspace");
      if (seen !== edits.current) return; // edited while loading: keep the local copy, the next refresh will catch up
      const { db: fresh, ...rest } = data;
      local.current = fresh;
      setDb(fresh);
      setInfo(rest);
    } catch (err) {
      if ((err as { status?: number }).status === 401) router.replace("/login");
      else setError(err instanceof Error ? err.message : "Could not load the data.");
    }
  }, [router]);

  useEffect(() => {
    // Loading from the server is syncing with an external system, which is what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const tick = () => document.visibilityState === "visible" && !working.current && void refresh();
    const timer = setInterval(tick, 20_000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);

  const value = useMemo<DataCtx | null>(() => {
    if (!db || !info) return null;
    const me = db.users.find((u) => u.id === info.meId) ?? db.users[0];

    const drain = async () => {
      let reload = false;
      while (queue.current.length) {
        const item = queue.current.shift()!;
        try {
          const res = await call<{ refresh?: boolean }>("ops", item);
          reload ||= !!res.refresh;
        } catch (err) {
          queue.current = [];
          reload = true;
          setError(err instanceof Error ? `That change was not saved: ${err.message}` : "That change was not saved.");
        }
      }
      working.current = null;
      if (reload) void refresh();
    };

    const dispatch = (op: Op): AnyRec | null => {
      const meta = newMeta(me.id);
      const next = structuredClone(local.current!) as DB;
      const result = applyOp(next, op, meta);
      local.current = next;
      edits.current++;
      setDb(next);
      // Typing into a field sends many small updates: fold them into one request.
      const last = queue.current[queue.current.length - 1];
      if (last && op.t === "update" && last.op.t === "update" && last.op.c === op.c && last.op.id === op.id && plain(op) && plain(last.op)) {
        last.op = { ...last.op, patch: { ...last.op.patch, ...op.patch } };
        last.meta = meta;
      } else {
        queue.current.push({ op, meta });
      }
      working.current ??= drain();
      return result;
    };

    return {
      ...info,
      db,
      me,
      create: (c, data) => dispatch({ t: "create", c, data })!,
      update: (c, id, patch) => void dispatch({ t: "update", c, id, patch }),
      remove: (c, id) => void dispatch({ t: "remove", c, ids: [id] }),
      removeMany: (c, ids) => void dispatch({ t: "remove", c, ids }),
      log: (activity) => void dispatch({ t: "log", activity }),
      api: async (path, body, method) => {
        if (working.current) await working.current;
        try {
          return await call(path, body, method);
        } finally {
          await refresh();
        }
      },
      refresh,
    };
  }, [db, info, refresh]);

  // The refs are only read inside event-time callbacks, never while rendering.
  /* eslint-disable react-hooks/refs */
  if (!value)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-stone-500" role="status">
        {error ?? "Loading…"}
      </div>
    );
  return (
    <Ctx.Provider value={value}>
      {error && (
        <div role="alert" className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-rose-600 px-4 py-2 text-sm text-white">
          {error}
          <button type="button" className="underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
  /* eslint-enable react-hooks/refs */
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
