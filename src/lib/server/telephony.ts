/* Click-to-call through Twilio. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
   TWILIO_FROM (a Twilio phone number) to switch it on. The call rings the
   user's own phone first, then connects them to the contact. */

export const telephonyConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

/** "+1 (555) 010-2030" -> "+15550102030". Returns "" when it is not a full international number. */
export function e164(phone: string) {
  const digits = phone.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(digits) ? digits : "";
}

export async function startCall(input: { userPhone: string; contactPhone: string; statusUrl: string }): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const from = process.env.TWILIO_FROM!;
  const form = new URLSearchParams({
    To: input.userPhone,
    From: from,
    // What Twilio does once the user picks up: dial the contact and bridge the two.
    Twiml: `<Response><Say>Connecting your call.</Say><Dial callerId="${from}">${input.contactPhone}</Dial></Response>`,
    StatusCallback: input.statusUrl,
    StatusCallbackEvent: "completed",
  });
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.message || `The phone provider answered ${res.status}` };
    return { ok: true, sid: data.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The call could not be started." };
  }
}
