-- Marketbooster Mission Control — sprint 1 schema.
-- Alle tabellen hebben RLS. Alleen de eigenaar (app_owner) mag lezen/schrijven met een gebruikerssessie.
-- Agents, dispatcher en cron gebruiken de service role (omzeilt RLS) en draaien alleen op de server.

create extension if not exists pgcrypto;

-- ── Enums ─────────────────────────────────────────────────────────────
create type channel as enum ('linkedin', 'instagram', 'email', 'phone', 'letter', 'blog', 'newsletter');
create type agent_name as enum ('scout', 'hunter', 'ranker', 'creator', 'listener', 'nurturer', 'analyst', 'chief');
create type item_type as enum ('post', 'carousel', 'reel', 'comment', 'dm', 'connect', 'email', 'call', 'letter', 'blog', 'newsletter', 'pitch');
create type item_status as enum ('pending', 'approved', 'scheduled', 'sent', 'rejected', 'snoozed', 'failed');
create type content_format as enum ('post', 'carousel', 'reel');
create type social_channel as enum ('linkedin', 'instagram');
create type idea_status as enum ('new', 'accepted', 'rejected', 'today');
create type calendar_status as enum ('planned', 'producing', 'ready', 'posted', 'failed');
create type run_status as enum ('running', 'ok', 'error');
create type run_trigger as enum ('manual', 'cron');
create type dispatch_outcome as enum ('sent', 'manual', 'failed', 'blocked', 'deferred');
create type lead_status as enum ('new', 'contacted', 'conversation', 'later', 'not_interested', 'customer');

-- ── Eigenaar ──────────────────────────────────────────────────────────
create table app_owner (
  email text primary key
);
comment on table app_owner is 'Vul met: insert into app_owner values (''jouw@mail.nl'');';

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_owner where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ── Merkbrein en instellingen (één rij) ──────────────────────────────
create table brain (
  id int primary key default 1 check (id = 1),
  tone text not null default '',
  icp text not null default '',
  pillars text[] not null default '{}',
  prices text not null default '',
  forbidden_words text[] not null default '{}',
  what_worked text not null default '',
  contentbank text[] not null default '{}',
  learnings jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
insert into brain (id, pillars) values (1, array['tijd terugwinnen','praktijkcases','AI-mythbusters','achter de schermen','branche-toepassingen']);

create or replace function append_learning(learning jsonb) returns void
language sql security invoker set search_path = public as $$
  update brain set learnings = (
    select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select x from jsonb_array_elements(learnings || jsonb_build_array(learning)) x
      offset greatest(jsonb_array_length(learnings) + 1 - 200, 0)
    ) t
  ) where id = 1;
$$;

create table settings (
  id int primary key default 1 check (id = 1),
  paused boolean not null default false,
  monthly_budget_eur numeric(10,2) not null default 100,
  daily_limits jsonb not null default '{"email":20,"linkedin":15,"instagram":5,"phone":15,"letter":5,"blog":1,"newsletter":1}',
  cold_email_enabled boolean not null default false,
  cron_enabled jsonb not null default '{}',
  budget_warned_month text
);
insert into settings (id) values (1);

-- ── Leads (gevuld in sprint 3) ───────────────────────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company text not null,
  contact_name text,
  role text,
  email text,
  phone text,
  linkedin_url text,
  website text,
  city text,
  region text,
  industry text,
  employees int,
  status lead_status not null default 'new',
  ai_opportunity text,
  buying_signal text,
  has_consent boolean not null default false,
  source text,
  last_contacted_at timestamptz,
  notes text
);
create index on leads (status);

create table lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,          -- connect, dm, call, letter, email, reply, meeting, status_change
  channel channel,
  summary text not null default '',
  inbox_item_id uuid
);
create index on lead_events (lead_id, at desc);

-- ── Goedkeur-inbox ───────────────────────────────────────────────────
create table inbox_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent agent_name not null,
  type item_type not null,
  channel channel not null,
  recipient text not null,
  recipient_key text,
  title text not null,
  reason text not null,
  value_hint text,
  body text not null,
  payload jsonb not null default '{}',
  status item_status not null default 'pending',
  priority int not null default 0,
  visible_from timestamptz,
  scheduled_at timestamptz,
  send_after timestamptz,
  snoozed_until timestamptz,
  reject_reason text,
  sent_at timestamptz,
  result jsonb,
  calendar_id uuid,
  lead_id uuid references leads(id) on delete set null
);
create index on inbox_items (status, priority desc, created_at);

-- Spelregel 1 in de database: alleen de service role (dispatcher) mag een item op 'sent' zetten.
create or replace function guard_sent_status() returns trigger
language plpgsql as $$
begin
  if new.status = 'sent' and old.status is distinct from 'sent' and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Alleen de dispatcher mag items verzenden';
  end if;
  if new.status = 'sent' and old.status not in ('approved', 'scheduled') then
    raise exception 'Alleen goedgekeurde items kunnen verzonden worden';
  end if;
  return new;
end $$;
create trigger inbox_items_guard_sent before update on inbox_items for each row execute function guard_sent_status();

create table dispatch_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  inbox_item_id uuid not null references inbox_items(id) on delete cascade,
  channel channel not null,
  recipient_key text,
  adapter text not null,
  outcome dispatch_outcome not null,
  detail text not null default '',
  body text not null default '',
  external_id text,
  external_url text
);
create index on dispatch_log (at desc);
create index on dispatch_log (recipient_key, at desc);

-- ── Social ───────────────────────────────────────────────────────────
create table content_ideas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  hook text not null,
  angle text not null default '',
  format content_format not null,
  pillar text not null,
  channel social_channel not null,
  tags text[] not null default '{}',
  status idea_status not null default 'new',
  reject_reason text,
  run_id uuid
);
create index on content_ideas (status, created_at desc);

create table calendar (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references content_ideas(id) on delete set null,
  channel social_channel not null,
  format content_format not null,
  pillar text not null,
  hook text not null,
  tags text[] not null default '{}',
  slot_at timestamptz not null,
  status calendar_status not null default 'planned',
  inbox_item_id uuid references inbox_items(id) on delete set null
);
create index on calendar (slot_at);
alter table inbox_items add constraint inbox_items_calendar_fk foreign key (calendar_id) references calendar(id) on delete set null;

-- ── Script van de week (sprint 2) ────────────────────────────────────
create table lead_magnets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  codeword text not null unique,       -- SCAN, TIJD, OFFERTE, INBOX, AGENT, CONTENT, TRAINING
  slug text not null unique,           -- marketbooster.nl/script/<slug>
  title text not null,
  problem text not null default '',
  pdf_path text,
  prompt_text text,
  video_script text,
  status text not null default 'draft',
  published_at timestamptz
);

create table downloads (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  lead_magnet_id uuid not null references lead_magnets(id) on delete cascade,
  email text not null,
  name text,
  opt_in_newsletter boolean not null default false,
  source text,                          -- instagram, linkedin, site
  lead_id uuid references leads(id) on delete set null
);
create index on downloads (email);

-- ── SEO en kansen (sprint 4) ─────────────────────────────────────────
create table keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  page text,
  position numeric(6,2),
  impressions int,
  clicks int,
  checked_at timestamptz not null default now()
);
create index on keywords (keyword, checked_at desc);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null,                   -- vacature, nieuws, vraag, lokaal, link
  title text not null,
  url text,
  summary text not null default '',
  status text not null default 'new',
  inbox_item_id uuid references inbox_items(id) on delete set null
);

-- ── Vangrails en logboek ─────────────────────────────────────────────
create table suppression (
  id uuid primary key default gen_random_uuid(),
  value text not null unique,           -- e-mail, domein, linkedin-url of telefoonnummer (genormaliseerd)
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent agent_name not null,
  trigger run_trigger not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status run_status not null default 'running',
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_eur numeric(10,4) not null default 0,
  items_created int not null default 0,
  error text
);
create index on agent_runs (started_at desc);

-- ── RLS: alles dicht, behalve voor de eigenaar ───────────────────────
do $$
declare t text;
begin
  foreach t in array array['app_owner','brain','settings','leads','lead_events','inbox_items','dispatch_log','content_ideas',
                           'calendar','lead_magnets','downloads','keywords','opportunities','suppression','agent_runs']
  loop
    execute format('alter table %I enable row level security', t);
    if t <> 'app_owner' then
      execute format('create policy owner_all on %I for all to authenticated using (is_owner()) with check (is_owner())', t);
    end if;
  end loop;
end $$;

-- Het logboek is alleen-lezen voor de eigenaar: schrijven doet alleen de dispatcher.
drop policy owner_all on dispatch_log;
create policy owner_read on dispatch_log for select to authenticated using (is_owner());
-- Runs worden alleen door agents geschreven.
drop policy owner_all on agent_runs;
create policy owner_read on agent_runs for select to authenticated using (is_owner());
