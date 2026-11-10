/* Tracking links inside marketing emails.
   /t/o/<sendId>  a 1x1 image: loading it records an open
   /t/c/<sendId>  the button link: records a click, then redirects to the real page */
import { getStore } from "@/lib/server/store";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await ctx.params;
  let target = "https://example.com";
  try {
    await getStore().updateDB((db) => {
      const send = db.sends.find((s) => s.id === id);
      if (!send) return;
      send.opened = true;
      if (kind === "c") send.clicked = true;
      // Only ever redirect to the link saved on the email itself, never to one taken from the URL.
      const url = db.emails.find((e) => e.id === send.emailId)?.ctaUrl ?? "";
      if (/^https?:\/\//i.test(url)) target = url;
    });
  } catch {
    /* tracking must never break the email */
  }
  if (kind === "c") return Response.redirect(target, 302);
  return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
}
