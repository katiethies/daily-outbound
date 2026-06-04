-- ============================================================
-- Outbound System — schema + seed data
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gdnzsuckxnuebwlnfgcf/editor
-- ============================================================

-- 1. companies
create table if not exists companies (
  id               uuid primary key default gen_random_uuid(),
  name             text,
  domain           text,
  linkedin_url     text,
  employee_range   text,
  estimated_arr    text,
  kind_of_business text,
  saas_or_agency   text,
  tier             text,
  outbound         boolean default false,
  attio_record_id  text,
  created_at       timestamptz default now()
);

-- 2. deals (references companies)
create table if not exists deals (
  id              uuid primary key default gen_random_uuid(),
  deal_name       text,
  deal_stage      text,
  deal_value      numeric,
  company_id      uuid references companies(id),
  next_due_task   date,
  notes           text,
  attio_record_id text,
  created_at      timestamptz default now()
);

-- 3. people (references both)
create table if not exists people (
  id                        uuid primary key default gen_random_uuid(),
  name                      text,
  email                     text,
  linkedin_url              text,
  job_title                 text,
  company_id                uuid references companies(id),
  connection_status         text default 'Not sent',
  connection_requested_date date,
  connected_on              date,
  outreach_status           text default 'Not started',
  last_outreach_date        date,
  first_dm_date             date,
  second_dm_date            date,
  third_dm_date             date,
  first_email_date          date,
  second_email_date         date,
  third_email_date          date,
  ongoing_dms_tally         integer default 0,
  ongoing_emails_tally      integer default 0,
  reply_status              text,
  next_due_task             date,
  prospect_source           text,
  dnc                       boolean default false,
  tier                      text,
  score                     integer,
  ai_draft_message          text,
  edited_message            text,
  deal_id                   uuid references deals(id),
  attio_record_id           text,
  channel                   text,
  personalization_type      text,
  created_at                timestamptz default now()
);

-- ============================================================
-- Seed data
-- ============================================================

insert into companies (id, name, domain, linkedin_url, employee_range, estimated_arr, kind_of_business, saas_or_agency, tier, outbound) values
  ('11111111-1111-1111-1111-111111111101', 'CloudScale Inc',   'cloudscale.io',     'https://linkedin.com/company/cloudscale',   '51-200',  '$1M-$5M',   'B2B',   'SaaS',        'A', true),
  ('11111111-1111-1111-1111-111111111102', 'Growth Agency',    'growthagency.co',   'https://linkedin.com/company/growthagency', '11-50',   '<$1M',      'B2B',   'Agency',      'B', true),
  ('11111111-1111-1111-1111-111111111103', 'DataOps Pro',      'dataopspro.com',    'https://linkedin.com/company/dataopspro',   '201-500', '$5M-$20M',  'B2B',   'SaaS',        'A', true),
  ('11111111-1111-1111-1111-111111111104', 'FunnelStack',      'funnelstack.io',    'https://linkedin.com/company/funnelstack',  '51-200',  '$1M-$5M',   'B2B',   'SaaS',        'A', true),
  ('11111111-1111-1111-1111-111111111105', 'Pixel & Co',       'pixelandco.com',    'https://linkedin.com/company/pixelco',      '1-10',    'Pre-revenue','B2C',  'Agency',      'C', false),
  ('11111111-1111-1111-1111-111111111106', 'MarketWave',       'marketwave.co',     'https://linkedin.com/company/marketwave',   '11-50',   '<$1M',      'B2B2C', 'Consultancy', 'B', true),
  ('11111111-1111-1111-1111-111111111107', 'Synapse AI',       'synapse.ai',        'https://linkedin.com/company/synapseai',    '201-500', '$20M+',     'B2B',   'SaaS',        'A', true),
  ('11111111-1111-1111-1111-111111111108', 'LaunchPad',        'launchpad.io',      'https://linkedin.com/company/launchpad',    '11-50',   '<$1M',      'B2B',   'Agency',      'B', true),
  ('11111111-1111-1111-1111-111111111109', 'TechVault',        'techvault.com',     'https://linkedin.com/company/techvault',    '51-200',  '$5M-$20M',  'B2B',   'SaaS',        'A', true),
  ('11111111-1111-1111-1111-111111111110', 'BrandFlow',        'brandflow.co',      'https://linkedin.com/company/brandflow',    '11-50',   '<$1M',      'B2B',   'Agency',      'C', false);

insert into deals (id, deal_name, deal_stage, deal_value, company_id, next_due_task, notes) values
  ('22222222-2222-2222-2222-222222222201', 'CloudScale — Onboarding',  'Booked call',      5000,  '11111111-1111-1111-1111-111111111101', current_date,       'Intro call scheduled'),
  ('22222222-2222-2222-2222-222222222202', 'DataOps Pro — Proposal',   'Proposal / Ideas', 8000,  '11111111-1111-1111-1111-111111111103', current_date - 1,   'Sent initial proposal'),
  ('22222222-2222-2222-2222-222222222203', 'Synapse AI — Closed',      'Won',              12000, '11111111-1111-1111-1111-111111111107', current_date + 3,   'Signed contract'),
  ('22222222-2222-2222-2222-222222222204', 'TechVault — Discovery',    'Scheduling',       6000,  '11111111-1111-1111-1111-111111111109', current_date - 2,   'Trying to book call'),
  ('22222222-2222-2222-2222-222222222205', 'FunnelStack — Early',      'Replied',          4000,  '11111111-1111-1111-1111-111111111104', current_date,       'Positive reply received'),
  ('22222222-2222-2222-2222-222222222206', 'Growth Agency — Intro',    'Replied',          2500,  '11111111-1111-1111-1111-111111111102', current_date - 3,   'Needs follow-up'),
  ('22222222-2222-2222-2222-222222222207', 'MarketWave — Proposal',    'Proposal / Ideas', 7500,  '11111111-1111-1111-1111-111111111106', current_date + 1,   'Reviewing our deck'),
  ('22222222-2222-2222-2222-222222222208', 'LaunchPad — Lost',         'Lost',             3000,  '11111111-1111-1111-1111-111111111108', null,               'Not a fit'),
  ('22222222-2222-2222-2222-222222222209', 'TechVault — Upsell',       'Scheduling',       9000,  '11111111-1111-1111-1111-111111111109', current_date + 2,   'Upsell conversation'),
  ('22222222-2222-2222-2222-222222222210', 'DataOps Pro — Enterprise', 'Booked call',      15000, '11111111-1111-1111-1111-111111111103', current_date,       'Enterprise tier discussion');

insert into people (id, name, email, linkedin_url, job_title, company_id, connection_status, connection_requested_date, connected_on, outreach_status, last_outreach_date, first_dm_date, first_email_date, ongoing_dms_tally, ongoing_emails_tally, reply_status, next_due_task, prospect_source, dnc, tier, score, ai_draft_message, deal_id, channel, personalization_type) values
  ('33333333-3333-3333-3333-333333333301', 'Sarah Chen',     'sarah@cloudscale.io',    'https://linkedin.com/in/sarahchen',    'Head of Growth',     '11111111-1111-1111-1111-111111111101', 'Connected',   '2026-05-01', '2026-05-05', 'In progress', current_date - 1, current_date - 5, null,               1, 0, 'Replied positive', current_date,     'LinkedIn', false, 'A', 92, 'Hi Sarah, loved your post on PLG at CloudScale — your take on activation loops was spot on. Would love to share how we helped a similar company cut time-to-value by 40%.', '22222222-2222-2222-2222-222222222201', 'LinkedIn DM',   'Manual'),
  ('33333333-3333-3333-3333-333333333302', 'James Okafor',   'james@dataopspro.com',   'https://linkedin.com/in/jamesokafor',  'VP of Engineering',  '11111111-1111-1111-1111-111111111103', 'Connected',   '2026-05-10', '2026-05-14', 'In progress', current_date - 3, null,             null,               0, 0, null,             current_date - 1, 'LinkedIn', false, 'A', 88, 'Hey James, impressive scale at DataOps Pro — noticed you''re handling petabyte-level pipelines. We help eng teams like yours reduce infrastructure costs by 30% without sacrificing reliability.', '22222222-2222-2222-2222-222222222202', 'LinkedIn DM',   'AI review'),
  ('33333333-3333-3333-3333-333333333303', 'Priya Nair',     'priya@synapse.ai',       'https://linkedin.com/in/priyanair',    'CEO',                '11111111-1111-1111-1111-111111111107', 'Connected',   '2026-04-15', '2026-04-20', 'Replied',     current_date - 7, current_date - 10, current_date - 8, 2, 1, 'Replied positive', current_date + 3, 'LinkedIn', false, 'A', 95, 'Priya, your AI-native GTM approach at Synapse is genuinely different from what I see in the market. Would love 20 mins to share how we''re helping AI-first companies scale outbound.', '22222222-2222-2222-2222-222222222203', 'Multichannel', 'Manual'),
  ('33333333-3333-3333-3333-333333333304', 'Tom Brennan',    'tom@techvault.com',      'https://linkedin.com/in/tombrennan',   'Director of Sales',  '11111111-1111-1111-1111-111111111109', 'Requested',   current_date - 10, null,       'Not started', null,             null,             null,               0, 0, null,             null,             'LinkedIn', false, 'A', 84, 'Tom, noticed TechVault just crossed $5M ARR — congrats! We help sales-led SaaS teams build predictable outbound at that stage. Worth a quick chat?', '22222222-2222-2222-2222-222222222204', 'LinkedIn DM',   'AI review'),
  ('33333333-3333-3333-3333-333333333305', 'Mei Lin',        'mei@funnelstack.io',     'https://linkedin.com/in/meilin',       'CMO',                '11111111-1111-1111-1111-111111111104', 'Connected',   '2026-05-20', '2026-05-25', 'In progress', current_date - 2, null,             null,               0, 0, null,             current_date,     'Referral', false, 'A', 90, 'Hi Mei, mutual friend Alex Kim suggested I reach out. You''re building something impressive at FunnelStack. I help CMOs like you turn pipeline visibility into a growth lever.', '22222222-2222-2222-2222-222222222205', 'LinkedIn DM',   'Manual'),
  ('33333333-3333-3333-3333-333333333306', 'David Park',     'david@growthagency.co',  'https://linkedin.com/in/davidpark',    'Founder',            '11111111-1111-1111-1111-111111111102', 'Requested',   current_date - 25, null,      'Not started', null,             null,             null,               0, 0, null,             null,             'LinkedIn', false, 'B', 70, 'David, saw your agency is expanding into B2B SaaS clients — that''s exactly where we shine. Happy to share a few frameworks that are working well for similar agencies.', '22222222-2222-2222-2222-222222222206', 'Email',         'Automated'),
  ('33333333-3333-3333-3333-333333333307', 'Rachel Torres',  'rachel@marketwave.co',   'https://linkedin.com/in/racheltorres', 'Head of Partnerships','11111111-1111-1111-1111-111111111106', 'Not sent',    null,           null,       'Not started', null,             null,             null,               0, 0, null,             null,             'LinkedIn', false, 'B', 75, 'Rachel, your work building MarketWave''s partner ecosystem caught my eye. We''ve helped similar consultancies accelerate partner-sourced revenue by 2x.', '22222222-2222-2222-2222-222222222207', 'LinkedIn DM',   'AI review'),
  ('33333333-3333-3333-3333-333333333308', 'Ben Walsh',      null,                     'https://linkedin.com/in/benwalsh',     'Growth Lead',        '11111111-1111-1111-1111-111111111108', 'Not sent',    null,           null,       'Not started', null,             null,             null,               0, 0, null,             null,             'LinkedIn', false, 'B', 68, 'Ben, LaunchPad''s growth trajectory is impressive for your stage. I help early-stage agencies systemize outbound before it becomes a bottleneck.', null,                                    'LinkedIn DM',   'Automated'),
  ('33333333-3333-3333-3333-333333333309', 'Nina Hoffman',   'nina@techvault.com',     'https://linkedin.com/in/ninahoffman',  'VP Product',         '11111111-1111-1111-1111-111111111109', 'Not sent',    null,           null,       'Not started', null,             null,             null,               0, 0, null,             null,             'Inbound',  false, 'A', 86, 'Nina, your product-led growth strategy at TechVault is exactly the kind of story we love working with. Would you be open to a 15-min call?', '22222222-2222-2222-2222-222222222209', 'Email',         'AI review'),
  ('33333333-3333-3333-3333-333333333310', 'Carlos Reyes',   'carlos@dataopspro.com',  'https://linkedin.com/in/carlosreyes',  'CTO',                '11111111-1111-1111-1111-111111111103', 'Requested',   current_date - 5, null,      'Not started', null,             null,             null,               0, 0, null,             null,             'LinkedIn', false, 'A', 89, 'Carlos, the engineering culture you''ve built at DataOps Pro is rare — especially at your scale. We''re helping CTOs like you turn eng velocity into a competitive moat.', '22222222-2222-2222-2222-222222222210', 'Multichannel', 'Manual');
