/* Sending email. The driver is chosen from environment variables:

   RESEND_API_KEY            -> Resend's HTTP API
   SMTP_HOST/SMTP_USER/...   -> any SMTP server (Gmail app password, Mailgun, ...)
   neither, in development   -> "outbox": messages are saved to ./data/outbox as .html files
   neither, in production    -> sending is switched off */
import fs from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { renderTokens } from "../segments";
import type { Company, Contact, MarketingEmail } from "../types";
import { DATA_DIR } from "./store";

export type MailDriver = "resend" | "smtp" | "outbox" | "none";

export function mailDriver(): MailDriver {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return process.env.NODE_ENV === "production" ? "none" : "outbox";
}

export function mailFrom() {
  return process.env.MAIL_FROM || (mailDriver() === "smtp" ? process.env.SMTP_USER : "") || "onboarding@resend.dev";
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  replyTo?: string;
}

export interface MailResult {
  ok: boolean;
  error?: string;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function viaResend(mail: Mail, from: string): Promise<MailResult> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, reply_to: mail.replyTo }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) {
      await pause(1100); // rate limited: wait and try again
      continue;
    }
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.message || `Resend answered ${res.status}` };
  }
  return { ok: false, error: "Rate limited by Resend" };
}

let transport: Transporter | null = null;

async function viaSmtp(mail: Mail, from: string): Promise<MailResult> {
  const port = Number(process.env.SMTP_PORT || 587);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: mail.replyTo });
  return { ok: true };
}

async function viaOutbox(mail: Mail, from: string): Promise<MailResult> {
  const dir = path.join(DATA_DIR, "outbox");
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${mail.to.replace(/[^a-z0-9@.-]/gi, "_")}.html`;
  await fs.writeFile(path.join(dir, name), `<!-- From: ${from}\n     To: ${mail.to}\n     Reply-To: ${mail.replyTo ?? ""}\n     Subject: ${mail.subject} -->\n${mail.html}`);
  return { ok: true };
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  const driver = mailDriver();
  if (driver === "none") return { ok: false, error: "Email sending is not configured." };
  const from = `"${mail.fromName.replace(/["<>\r\n]/g, "")}" <${mailFrom()}>`;
  try {
    if (driver === "resend") return await viaResend(mail, from);
    if (driver === "smtp") return await viaSmtp(mail, from);
    return await viaOutbox(mail, from);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sending failed" };
  }
}

/* ---- Turning our plain-text bodies into HTML ---- */

export function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

const shell = (inner: string) =>
  `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1c1917"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">${inner}</div></body></html>`;

/** A one-to-one email written from a record page. */
export function plainEmailHtml(body: string) {
  return shell(paragraphs(body));
}

/** A marketing email: personalised, with a tracked button, an open pixel and an unsubscribe link. */
export function marketingEmail(email: MarketingEmail, contact: Contact, company: Company | undefined, links: { open: string; click: string; unsubscribe: string }) {
  const t = (s: string) => renderTokens(s, contact, company);
  const button = email.ctaLabel
    ? `<p style="margin:8px 0 20px"><a href="${esc(links.click)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">${esc(t(email.ctaLabel))}</a></p>`
    : "";
  const footer = `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e7e5e4;font-size:12px;color:#78716c">You are receiving this because you subscribed. <a href="${esc(links.unsubscribe)}" style="color:#78716c">Unsubscribe</a></p>`;
  const preview = email.previewText ? `<div style="display:none;max-height:0;overflow:hidden">${esc(t(email.previewText))}</div>` : "";
  return {
    subject: t(email.subject),
    html: shell(`${preview}${paragraphs(t(email.body))}${button}${footer}<img src="${esc(links.open)}" width="1" height="1" alt="" style="display:block">`),
    text: `${t(email.body)}\n\n${email.ctaLabel ? `${t(email.ctaLabel)}: ${links.click}\n\n` : ""}Unsubscribe: ${links.unsubscribe}`,
  };
}
