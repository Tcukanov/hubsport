"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildSeed } from "@/lib/seed";
import { createRecord, deleteRecord, updateRecord } from "@/lib/mutations";
import type { AnyRec, CollectionName, DB, Patch, User } from "@/lib/types";

/* The whole database is one JSON object kept in the browser's localStorage.
   Every change clones it, applies a mutation, and saves it back. */
const KEY = "pipeline-db-v1";

interface DataCtx {
  db: DB;
  me: User;
  mutate: <T>(fn: (db: DB) => T) => T;
  create: (c: CollectionName, data: Patch) => AnyRec;
  update: (c: CollectionName, id: string, patch: Patch) => void;
  remove: (c: CollectionName, id: string) => void;
  removeMany: (c: CollectionName, ids: string[]) => void;
  reset: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<DB | null>(null);
  const [db, setDb] = useState<DB | null>(null);

  const commit = useCallback((next: DB, save = true) => {
    ref.current = next;
    setDb(next);
    if (save) {
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep working in memory */
      }
    }
  }, []);

  useEffect(() => {
    let loaded: DB | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch {
      loaded = null;
    }
    // Loading from localStorage is syncing with an external store, which is what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    commit(loaded ?? buildSeed(), !loaded);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) commit(JSON.parse(e.newValue), false);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [commit]);

  const value = useMemo<DataCtx | null>(() => {
    if (!db) return null;
    const mutate = <T,>(fn: (d: DB) => T): T => {
      const next = structuredClone(ref.current!) as DB;
      const result = fn(next);
      commit(next);
      return result;
    };
    return {
      db,
      me: db.users[0],
      mutate,
      create: (c, data) => mutate((d) => createRecord(d, c, data)),
      update: (c, id, patch) => void mutate((d) => updateRecord(d, c, id, patch)),
      remove: (c, id) => mutate((d) => deleteRecord(d, c, id)),
      removeMany: (c, ids) => mutate((d) => ids.forEach((id) => deleteRecord(d, c, id))),
      reset: () => commit(buildSeed()),
    };
  }, [db, commit]);

  // The ref is only read inside event-time callbacks (mutate), never while rendering.
  /* eslint-disable react-hooks/refs */
  if (!value) return <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">Loading…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  /* eslint-enable react-hooks/refs */
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
