# Pipeline CRM

A learning-project CRM built with Next.js, TypeScript and Tailwind.

## What it does

- **Home**: tasks due, pipeline numbers, recent activity
- **Contacts, Companies, Deals**: searchable tables, record pages with editable properties, activity timeline (notes, calls, emails, meetings, tasks) and associations
- **Deals board**: drag deals between pipeline stages
- **Tasks**: due today, overdue, upcoming, completed
- **Segments**: filter-based contact lists that update live
- **Forms**: form builder plus a public page (`/f/<id>`); each submission creates or updates a contact
- **Marketing emails**: editor with personalisation tokens, segment targeting and a simulated send with open and click reporting
- **Dashboards and activity feed**

## Data

There is no server database. The whole dataset is one JSON object stored in the browser's `localStorage` (`src/components/data.tsx`), seeded with demo data from `src/lib/seed.ts`. Every change goes through the pure functions in `src/lib/mutations.ts`. Each browser has its own copy; use "Reset demo data" in the sidebar to start over. No real email is ever sent.

## Run it

```bash
npm install
npm run dev
```
