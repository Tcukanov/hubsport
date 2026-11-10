# Pipeline CRM

A learning-project CRM built with Next.js, TypeScript and Tailwind.

## What it does

- **Home**: tasks due, pipeline numbers, recent activity
- **Contacts, Companies, Deals**: searchable tables, record pages with editable properties, activity timeline and associations
- **Deals board**: drag deals between pipeline stages
- **Inbox**: shared conversations fed by an inbound-email webhook and form messages; reply by email, leave internal notes, assign, close, turn into a ticket
- **Meeting scheduling**: a public booking page per user (`/meet/<slug>`) with availability, double-booking protection, confirmation emails and calendar files
- **Calling**: click-to-call through Twilio when configured, otherwise a phone link; calls are logged on the timeline
- **Tickets** with a status board, **Products**, line items on deals, and **Orders**
- **Calls** and **Meetings**: every logged call and meeting across all records
- **Tasks**, **Segments** (filter-based lists), **Forms** (builder + public page at `/f/<id>`)
- **Marketing emails**: real sending to a segment, with open and click tracking and unsubscribe links
- **One-to-one emails** from any record page
- **Automation**: workflows with a trigger (form submitted, deal stage changed, ...) and actions (create task, send email, set property, add note)
- **Prospecting agent**: summarises what the CRM knows about a contact and drafts a first email; a person approves before it is sent
- **Users**: sign-in, invitations, admin and member roles
- **Dashboards and activity feed**

## How it works

- `src/lib/mutations.ts` holds every change to the data as a pure function. The browser applies a change instantly and sends the same "operation" to the server, which applies it to the real database (`src/components/data.tsx`, `src/app/api/[...path]/route.ts`).
- `src/lib/server/store.ts` stores the data in Postgres when `DATABASE_URL` is set, otherwise in `data/store.json`.
- `src/lib/server/auth.ts` does sign-in with scrypt-hashed passwords and a signed session cookie. The first person to sign up becomes the admin; everyone else joins by invitation.
- `src/lib/server/mailer.ts` sends through Resend or SMTP. In development with neither configured, emails are written to `data/outbox/` as HTML files.
- `src/lib/server/workflows.ts` is the automation engine; `src/lib/server/prospecting.ts` is the prospecting agent.

## Run it locally

```bash
npm install
npm run dev
```

Open the app, create the workspace (first sign-up), and explore. No setup is needed locally.

## Tests

```bash
npm test
```

Runs the automated tests in `tests/`: the rules for what the browser may change, record clean-up, form submissions, inbox threading, automation workflows, segments, and meeting-slot calculation across time zones.

## Deploy on Vercel

1. Import the repository.
2. Storage tab: add a Postgres database (Neon) and connect it to the project. This sets `DATABASE_URL`.
3. Settings -> Environment Variables: add the email settings from `.env.example` (and `ANTHROPIC_API_KEY` if you want AI drafts).
4. Redeploy, open the site and sign up: the first account becomes the admin.
