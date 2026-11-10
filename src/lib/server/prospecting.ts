/* The prospecting agent: for one contact, summarise what the CRM knows about
   them and draft a first outreach email for a person to review.

   With ANTHROPIC_API_KEY set the draft is written by Claude. Without it (or
   if the request fails) a plain template is used, so the feature still works. */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { LIFECYCLE, optionLabel } from "../config";
import type { Company, Contact, DB } from "../types";

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export interface Draft {
  research: string;
  subject: string;
  body: string;
  generatedBy: "ai" | "template";
}

export interface DraftSettings {
  pitch: string;
  tone: string;
  senderName: string;
}

const DraftSchema = z.object({
  research: z.string().describe("Two or three sentences on who this person is and why they are worth contacting, using only the facts provided."),
  subject: z.string().describe("Email subject line, under 60 characters."),
  body: z.string().describe("Plain-text email body with blank lines between paragraphs."),
});

const SYSTEM = `You help a salesperson prepare first-touch outreach emails from their CRM records.

For the contact you are given, write a short research summary and a draft email.

Rules for the email:
- Under 110 words, plain text, two or three short paragraphs separated by blank lines.
- Open with something specific to this person or their company, taken from the facts provided.
- Connect it to what the sender offers, then end with one low-pressure question or next step.
- Use only facts present in the data. Never invent meetings, numbers, mutual contacts or news.
- No placeholders such as [Name]. Sign off with the sender's first name.
- The email is a draft a person will review before anything is sent.`;

/** The facts about a contact that the agent is allowed to use. */
export function contactFacts(db: DB, contact: Contact) {
  const company = db.companies.find((c) => c.id === contact.companyId);
  const recent = db.activities
    .filter((a) => a.contactId === contact.id && ["note", "call", "email", "meeting", "form_submission"].includes(a.type))
    .slice(0, 5)
    .map((a) => ({ type: a.type, date: a.createdAt.slice(0, 10), text: [a.subject, a.body].filter(Boolean).join(": ").slice(0, 400) }));
  const deals = db.deals.filter((d) => d.contactIds.includes(contact.id)).map((d) => ({ name: d.name, stage: d.stage, amount: d.amount }));
  return {
    company,
    facts: {
      contact: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        jobTitle: contact.jobTitle,
        city: contact.city,
        country: contact.country,
        lifecycleStage: optionLabel(LIFECYCLE, contact.lifecycleStage),
        source: contact.source,
      },
      company: company ? { name: company.name, industry: company.industry, employees: company.size, city: company.city, country: company.country } : null,
      recentActivity: recent,
      deals,
    },
  };
}

function templateDraft(contact: Contact, company: Company | undefined, s: DraftSettings): Draft {
  const first = contact.firstName || "there";
  const where = company ? `${company.name}${company.industry ? `, a ${company.industry.toLowerCase()} company` : ""}${company.city ? ` in ${company.city}` : ""}` : "their company";
  const role = contact.jobTitle ? `${contact.jobTitle} at ${where}` : `a contact at ${where}`;
  return {
    generatedBy: "template",
    research: `${contact.firstName} ${contact.lastName} is ${role}. Lifecycle stage: ${optionLabel(LIFECYCLE, contact.lifecycleStage)}.`,
    subject: company ? `An idea for ${company.name}` : `Quick question, ${first}`,
    body: `Hi ${first},\n\nI'm reaching out because of your role${contact.jobTitle ? ` as ${contact.jobTitle}` : ""}${company ? ` at ${company.name}` : ""}. ${s.pitch.trim() || "We help teams like yours keep their sales pipeline organised."}\n\nWould a short call next week be useful?\n\n${s.senderName.split(" ")[0]}`,
  };
}

let client: Anthropic | null = null;

export async function draftOutreach(db: DB, contact: Contact, settings: DraftSettings): Promise<Draft> {
  const { company, facts } = contactFacts(db, contact);
  if (!aiConfigured()) return templateDraft(contact, company, settings);

  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // If a safety classifier declines the request, the API retries it on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(DraftSchema) },
      messages: [
        {
          role: "user",
          content: `What the sender offers:\n${settings.pitch.trim() || "(not specified - keep the email general)"}\n\nTone: ${settings.tone || "friendly and direct"}\nSender: ${settings.senderName}\n\nCRM data for this contact:\n${JSON.stringify(facts, null, 2)}`,
        },
      ],
    });
    const out = response.parsed_output;
    if (response.stop_reason === "refusal" || !out) return templateDraft(contact, company, settings);
    return { ...out, generatedBy: "ai" };
  } catch (err) {
    console.error("Prospecting draft failed, using the template instead:", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    return templateDraft(contact, company, settings);
  }
}
