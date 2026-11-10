/* Shared helpers for the API routes. */
import type { DB, User } from "../types";
import { currentUser } from "./auth";
import { getStore, type AppUser } from "./store";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });

/** Wrap a handler so thrown HttpErrors become clean JSON responses. */
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Something went wrong." }, 500);
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "Only admins can do this.");
  return user;
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** The public address of this app, for links inside emails. */
export function originOf(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

const COLORS = ["#7c3aed", "#0d9488", "#d97706", "#db2777", "#2563eb", "#059669", "#dc2626", "#4f46e5"];
export const colorFor = (n: number) => COLORS[n % COLORS.length];

export const publicUser = (u: AppUser): User => ({ id: u.id, name: u.name, email: u.email, color: u.color, role: u.role });

/** Copy the people who can sign in into the CRM data, keeping the demo teammates. */
export async function syncUsers() {
  const store = getStore();
  const users = await store.listUsers();
  await store.updateDB((db: DB) => {
    const ids = new Set(users.map((u) => u.id));
    const demo = db.users.filter((u) => u.demo);
    demo.forEach((u) => ids.add(u.id));
    db.users = [...users.map(publicUser), ...demo];
    // Anything owned by a removed user becomes unassigned.
    for (const list of [db.contacts, db.companies, db.deals, db.tasks]) for (const rec of list) if (rec.ownerId && !ids.has(rec.ownerId)) rec.ownerId = null;
  });
}
