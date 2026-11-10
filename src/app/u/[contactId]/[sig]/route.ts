/* The unsubscribe link at the bottom of every marketing email. */
import { logActivity, newMeta, withMeta } from "@/lib/mutations";
import { shortSig } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";

const page = (title: string, text: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:Arial,sans-serif;background:#faf9f7;color:#1c1917;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><div style="background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:32px;max-width:420px;text-align:center"><h1 style="font-size:20px;margin:0 0 8px">${title}</h1><p style="margin:0;color:#57534e">${text}</p></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

export async function GET(_req: Request, ctx: { params: Promise<{ contactId: string; sig: string }> }) {
  const { contactId, sig } = await ctx.params;
  // The signature proves the link came from one of our emails, so nobody can unsubscribe other people by guessing ids.
  if (sig !== shortSig(contactId)) return page("Link not valid", "This unsubscribe link is not valid.");
  await getStore().updateDB((db) =>
    withMeta(newMeta(null), () => {
      const contact = db.contacts.find((c) => c.id === contactId);
      if (!contact || !contact.subscribed) return;
      contact.subscribed = false;
      logActivity(db, { type: "note", body: "Unsubscribed from marketing emails using the link in an email.", contactId, companyId: contact.companyId });
    }),
  );
  return page("You are unsubscribed", "You will not receive further marketing emails from us.");
}
