# Outbound OS — Build Progress

## What This Is
An outbound sales system for Katie Thies (@katiethies) that surfaces the right leads to action every day. Built as a React web app connected to Supabase, syncing bidirectionally with Attio CRM.

## Live URLs
- App: https://daily-outbound.vercel.app
- GitHub: https://github.com/katiethies/daily-outbound
- Supabase: https://supabase.com/dashboard/project/gdnzsuckxnuebwlnfgcf

## Architecture
Deepline/Clay → Supabase (hub, we own) → Attio (CRM sync)
                                        → Heyreach/Smartlead/LGM (sequencing, not built yet)

## Tech Stack
- Frontend: React + Tailwind CSS
- Database: Supabase (Postgres)
- Hosting: Vercel
- CRM: Attio
- Sync: Custom sync script at /api/sync.js (runs every 15 min via cron-job.org)

## Database Tables
- people — one record per prospect, maps to Attio People
- companies — maps to Attio Companies
- deals — maps to Attio Deals (stages: Replied, Scheduling, Booked call, Proposal / Ideas, Won, Lost)

## Supabase Credentials
- Project URL: https://gdnzsuckxnuebwlnfgcf.supabase.co
- Project ID: gdnzsuckxnuebwlnfgcf

## App Sections (7 interfaces)
1. Attio pipeline follow-ups — deals not in Won/Lost/Dormant, split into needs-task (top) and has-task (sorted by due date)
2. LinkedIn connection requests — prospect_source not null, connection_status not sent/connected/cannot send, outreach_status null, dnc not true
3. Update accepted connections — connection_status = 'Connection request sent', within last 21 days
4. Remove old pending requests — connection_status = 'Connection request sent', older than 21 days
5. LinkedIn DM — two groups: first DMs (connected, outreach_status null) and follow-up DMs (outreach_status in First DM/Second DM/Ongoing DMs/Third DM, last contact 5+ days ago)
6. Email — two groups: first emails and follow-up emails (same pattern as DMs)
7. Daily summary — today's stats + replies

## Sync Script
- Location: /api/sync.js and /scripts/initial-sync.mjs
- Attio → Supabase: pulls all People, Companies, Deals and upserts by attio_record_id
- Supabase → Attio: pushes outreach fields back (connection_status, dm dates, email dates, tallies, reply_status, next_due_task)
- Trigger: cron-job.org hitting https://daily-outbound.vercel.app/api/sync every 15 min (NOT YET SET UP)
- Manual sync button: built into app header, calls /api/sync?full=1

## Attio Field Slug Fixes (already applied)
- personalization_type → pitch_type / status
- connection_requested_date → connection_request_sent
- deal_id lookup → associated_deals
- ai_draft_message → sales_approach_summary
- estimated_arr → estimated_arr_usd
- saas_or_agency → saas_agency
- outbound → outbound_y_n

## Fields That Don't Exist in Attio (will stay null until added)
- tier (on people)
- score
- channel
- next_due_task (on people)

## Known Issues / Next Steps

### Immediate (do next session):
- [x] Fix all app filters to match real Attio values — deployed 2026-06-05
- [x] Deploy filter fixes to Vercel — commit 2fd2cc0

### After that:
- [x] Set up cron-job.org — two jobs running as of 2026-06-05: push every 15 min (/api/sync), full pull daily at 6am UTC (/api/sync?full=1)
- [ ] Build connected → re-enrich trigger (when connection_status changes to Connected, trigger Deepline enrichment)
- [ ] Connect Airtable → Heyreach via API
- [ ] Connect Airtable → Smartlead/Instantly via API
- [ ] Set up activity webhooks from Heyreach/Smartlead → Supabase
- [ ] Build scoring formula logic in Supabase
- [ ] UI overhaul (Katie will direct this separately)
- [ ] Test full flow end to end
- [ ] Document system for client onboarding

## Important Notes
- Each client gets their own Supabase instance + Vercel deployment from the same GitHub repo
- Pushing to GitHub auto-deploys to Vercel for all clients = software update model
- Attio is Katie's CRM. Future clients may be on HubSpot, Salesforce, or GHL
- Clay/Deepline handles enrichment and primary scoring — Supabase only does lightweight formula adjustments
- No auth on the app — each deployment is private by URL
- Select field options come from Attio — do not hardcode them, query distinct values from Supabase
- Company tier filter uses companies.tier joined to people — not a direct field on people
