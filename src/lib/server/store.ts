/* Where the data lives.

   - With DATABASE_URL (or POSTGRES_URL) set: Postgres. Two tables, one for
     people who can sign in and one holding the CRM data as a JSON document.
   - Without it: a JSON file in ./data, so the app runs locally with no setup. */
import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import type { DB } from "../types";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "admin" | "member";
  color: string;
  createdAt: string;
}

export interface Store {
  kind: "postgres" | "file";
  listUsers(): Promise<AppUser[]>;
  saveUser(user: AppUser): Promise<void>;
  deleteUser(id: string): Promise<void>;
  readDB(): Promise<DB | null>;
  writeDB(db: DB): Promise<void>;
  /** Load the data, let `fn` change it, save it. Runs one at a time. */
  updateDB<T>(fn: (db: DB) => T): Promise<T>;
}

export const DATA_DIR = path.join(process.cwd(), "data");

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function fileStore(): Store {
  const file = path.join(DATA_DIR, "store.json");
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };
  const load = async (): Promise<{ users: AppUser[]; db: DB | null }> => {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      return { users: [], db: null };
    }
  };
  const save = async (state: { users: AppUser[]; db: DB | null }) => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(state));
  };
  const change = <T,>(fn: (s: { users: AppUser[]; db: DB | null }) => T) =>
    exclusive(async () => {
      const state = await load();
      const result = fn(state);
      await save(state);
      return result;
    });

  return {
    kind: "file",
    listUsers: async () => (await load()).users,
    saveUser: (user) =>
      change((s) => {
        s.users = [...s.users.filter((u) => u.id !== user.id), user];
      }),
    deleteUser: (id) =>
      change((s) => {
        s.users = s.users.filter((u) => u.id !== id);
      }),
    readDB: async () => (await load()).db,
    writeDB: (db) =>
      change((s) => {
        s.db = db;
      }),
    updateDB: (fn) =>
      change((s) => {
        if (!s.db) throw new Error("The workspace has not been created yet.");
        return fn(s.db);
      }),
  };
}

function postgresStore(url: string): Store {
  // prepare:false keeps this compatible with pooled connections (Neon, Supabase, pgbouncer).
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 20, onnotice: () => undefined });
  let ready: Promise<void> | null = null;
  const init = () =>
    (ready ??= (async () => {
      await sql`create table if not exists crm_users (
        id text primary key,
        email text unique not null,
        name text not null,
        password_hash text not null,
        role text not null,
        color text not null,
        created_at timestamptz not null default now()
      )`;
      await sql`create table if not exists crm_workspace (id int primary key, data jsonb not null)`;
    })());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toUser = (r: any): AppUser => ({ id: r.id, email: r.email, name: r.name, passwordHash: r.password_hash, role: r.role, color: r.color, createdAt: new Date(r.created_at).toISOString() });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asJson = (db: DB) => sql.json(db as any);

  return {
    kind: "postgres",
    async listUsers() {
      await init();
      return (await sql`select * from crm_users order by created_at`).map(toUser);
    },
    async saveUser(u) {
      await init();
      await sql`insert into crm_users (id, email, name, password_hash, role, color, created_at)
        values (${u.id}, ${u.email}, ${u.name}, ${u.passwordHash}, ${u.role}, ${u.color}, ${u.createdAt})
        on conflict (id) do update set email = excluded.email, name = excluded.name, password_hash = excluded.password_hash, role = excluded.role, color = excluded.color`;
    },
    async deleteUser(id) {
      await init();
      await sql`delete from crm_users where id = ${id}`;
    },
    async readDB() {
      await init();
      const rows = await sql`select data from crm_workspace where id = 1`;
      return rows.length ? (rows[0].data as DB) : null;
    },
    async writeDB(db) {
      await init();
      await sql`insert into crm_workspace (id, data) values (1, ${asJson(db)}) on conflict (id) do update set data = excluded.data`;
    },
    async updateDB(fn) {
      await init();
      return (await sql.begin(async (tx) => {
        // "for update" locks the row so two people saving at once cannot overwrite each other.
        const rows = await tx`select data from crm_workspace where id = 1 for update`;
        if (!rows.length) throw new Error("The workspace has not been created yet.");
        const db = rows[0].data as DB;
        const result = fn(db);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx`update crm_workspace set data = ${tx.json(db as any)} where id = 1`;
        return result;
      })) as ReturnType<typeof fn>;
    },
  };
}

const holder = globalThis as unknown as { __pipelineStore?: Store };

export function getStore(): Store {
  if (holder.__pipelineStore) return holder.__pipelineStore;
  const url = databaseUrl();
  if (!url && process.env.VERCEL) throw new Error("No database is connected. Add a Postgres database in Vercel (Storage tab) so DATABASE_URL is set, then redeploy.");
  holder.__pipelineStore = url ? postgresStore(url) : fileStore();
  return holder.__pipelineStore;
}
