/* Sign-in without any library: passwords are hashed with scrypt, and the
   session is a signed cookie holding the user id and an expiry time. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { DATA_DIR, databaseUrl, getStore, type AppUser } from "./store";

const COOKIE = "pipeline_session";
const DAY = 864e5;

let cachedSecret: string | null = null;

function secret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.AUTH_SECRET) return (cachedSecret = process.env.AUTH_SECRET);
  // No AUTH_SECRET: derive one from the database URL (itself a secret) so a deploy works with one variable.
  if (databaseUrl()) return (cachedSecret = crypto.createHash("sha256").update(`pipeline:${databaseUrl()}`).digest("hex"));
  // Local file store: keep a random secret next to the data.
  const file = path.join(DATA_DIR, "secret.txt");
  try {
    return (cachedSecret = fs.readFileSync(file, "utf8"));
  } catch {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const value = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(file, value);
    return (cachedSecret = value);
  }
}

const hmac = (text: string) => crypto.createHmac("sha256", secret()).update(text).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

export function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return safeEqual(crypto.scryptSync(password, salt, 64).toString("hex"), hash);
}

/** A tamper-proof token: the payload plus a signature only this server can produce. */
export function signToken(payload: Record<string, unknown>, days: number) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + days * DAY })).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function readToken<T = Record<string, unknown>>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/** Short signature used in unsubscribe links. */
export function shortSig(text: string) {
  return hmac(`unsub:${text}`).slice(0, 24);
}

export async function startSession(userId: string) {
  (await cookies()).set(COOKIE, signToken({ uid: userId }, 30), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<AppUser | null> {
  const session = readToken<{ uid: string }>((await cookies()).get(COOKIE)?.value);
  if (!session) return null;
  return (await getStore().listUsers()).find((u) => u.id === session.uid) ?? null;
}
