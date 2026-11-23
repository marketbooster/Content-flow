-- ContentFlow · Seasonal Intelligence & AI Content Council
-- Doel-datamodel voor de multi-user versie (Supabase/Postgres). De MVP draait nog lokaal
-- (localStorage + JSON op de server) met exact dezelfde vormen, zodat migreren 1-op-1 kan.
--
-- Principes
-- * Eén planningsbron: content_items. Seizoensideeën koppelen daaraan, geen tweede planner.
-- * Uniciteit voorkomt dubbele kalenderitems en dubbele ideeën.
-- * RLS: creators zien alleen hun eigen gegevens. De gedeelde kalender is leesbaar voor
--   iedereen die is ingelogd, maar alleen beheerders (service role) schrijven erin.

create extension if not exists "pgcrypto";

-- ───────────── Accounts ─────────────
create table public.creators (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  handle        text,
  brand_voice   text not null default '',
  audience      text not null default '',
  region        text not null default 'NL' check (region in ('NL','NL-noord','NL-midden','NL-zuid')),
  hours_per_week numeric(4,1) not null default 8 check (hours_per_week between 0 and 80),
  blocked_topics text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index on public.creators (owner_id);

create table public.creator_pillars (
  creator_id uuid not null references public.creators(id) on delete cascade,
  pillar     text not null,
  label      text not null,
  weight     numeric(3,2) not null check (weight between 0 and 1),
  primary key (creator_id, pillar)
);

-- ───────────── Seizoenskalender ─────────────
create table public.event_sources (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  url         text,
  created_at  timestamptz not null default now()
);

-- creator_id NULL = beheerde, gedeelde gebeurtenis. Gevuld = persoonlijk moment of eigen trend.
create table public.seasonal_events (
  id              text primary key,                -- bv. 'sinterklaas', 'eigen-…'
  creator_id      uuid references public.creators(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('feestdag_nl','feestdag_int','seizoen','schoolvakantie','commercieel','awareness','sport','cultureel','niche','persoonlijk','trend')),
  date_kind       text not null check (date_kind in ('fixed','computed','verified','trend')),
  recurrence_rule jsonb not null,                  -- zie src/domain/types.ts RecurrenceRule
  region          text not null default 'NL',
  pillar_fit      jsonb not null default '{}',     -- {"recepten":1,"humor":0.8}
  audiences       text[] not null default '{}',
  content_categories text[] not null default '{}',
  source_id       uuid references public.event_sources(id),
  last_verified   date,
  expires_at      date,                            -- verplicht voor trends
  weight          smallint not null default 1 check (weight between 1 and 3),
  prep_override   jsonb,
  description     text,
  created_at      timestamptz not null default now(),
  -- Trends zonder bron, vaststellingsdatum of vervaldatum zijn niet toegestaan.
  constraint trend_needs_evidence check (
    date_kind <> 'trend' or (source_id is not null and last_verified is not null and expires_at is not null)
  )
);
create index on public.seasonal_events (creator_id);

-- Gematerialiseerde voorkomens (per jaar berekend door een job). Uniek per event+start.
create table public.event_occurrences (
  event_id     text not null references public.seasonal_events(id) on delete cascade,
  start_date   date not null,
  end_date     date not null check (end_date >= start_date),
  region       text not null,
  reliability  text not null check (reliability in ('betrouwbaar','berekend','te_verifieren','verlopen')),
  verified_at  date,
  verified_by  uuid references auth.users(id),
  primary key (event_id, start_date)
);
create index on public.event_occurrences (start_date);

-- Relevantie per creator (cache van de berekening + handmatige overrides).
create table public.creator_event_relevance (
  creator_id  uuid not null references public.creators(id) on delete cascade,
  event_id    text not null references public.seasonal_events(id) on delete cascade,
  score       smallint not null check (score between 0 and 100),
  muted       boolean not null default false,
  prep_override jsonb,
  updated_at  timestamptz not null default now(),
  primary key (creator_id, event_id)
);

-- ───────────── Ideeën & planning ─────────────
create table public.idea_templates (
  id                  text primary key,
  event_id            text references public.seasonal_events(id) on delete cascade, -- NULL = tijdloos
  pillar              text not null,
  format              text not null,
  title               text not null,
  hook                text not null,
  description         text not null,
  publish_days_before integer not null default 0,
  production_minutes  integer not null default 60,
  tags                text[] not null default '{}',
  needs_nutrition_calc boolean not null default false,
  commercial          boolean not null default false
);

-- Gegenereerde of handmatig gekozen seizoenssuggesties per creator en voorkomen.
create table public.seasonal_content_suggestions (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.creators(id) on delete cascade,
  event_id      text not null,
  occurrence_start date not null,
  template_id   text references public.idea_templates(id),
  ai_job_id     uuid,                              -- als de suggestie door AI is gemaakt
  payload       jsonb not null,                    -- titel/hook/omschrijving (bij AI-varianten)
  ideal_publish_date date not null,
  created_at    timestamptz not null default now(),
  foreign key (event_id, occurrence_start) references public.event_occurrences(event_id, start_date) on delete cascade,
  -- geen dubbele ideeën: één template per voorkomen per creator
  unique (creator_id, event_id, occurrence_start, template_id)
);

-- Swipe-beslissingen (bewaard/afgewezen). Afgewezen ideeën komen niet terug.
create table public.idea_feedback (
  creator_id  uuid not null references public.creators(id) on delete cascade,
  idea_key    text not null,                       -- `${templateId}@${eventId}:${start}`
  decision    text not null check (decision in ('bewaard','afgewezen')),
  decided_at  timestamptz not null default now(),
  primary key (creator_id, idea_key)
);
create view public.saved_ideas as
  select * from public.idea_feedback where decision = 'bewaard';

-- Bestaande planningsbron. Seizoensideeën worden hier ingepland (geen tweede planner).
create table public.content_items (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references public.creators(id) on delete cascade,
  title               text not null,
  hook                text,
  description         text,
  pillar              text not null,
  format              text not null,
  status              text not null default 'idee' check (status in ('idee','gepland','in_productie','klaar','gepubliceerd')),
  publish_date        date,
  event_id            text,
  occurrence_start    date,
  idea_template_id    text references public.idea_templates(id),
  production_minutes  integer,
  script              text,
  shotlist            text[],
  needs_nutrition_calc boolean not null default false,
  source              text not null check (source in ('handmatig','seasonal','maandplanning','ai')),
  created_at          timestamptz not null default now(),
  foreign key (event_id, occurrence_start) references public.event_occurrences(event_id, start_date) on delete set null (event_id, occurrence_start)
);
create index on public.content_items (creator_id, publish_date);
-- Hetzelfde idee voor hetzelfde moment maar één keer inplannen.
create unique index content_items_no_duplicate_idea
  on public.content_items (creator_id, idea_template_id, event_id, occurrence_start)
  where idea_template_id is not null and event_id is not null;

create table public.content_plans (                 -- resultaat van "Maak mijn maandplanning"
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references public.creators(id) on delete cascade,
  month        date not null,                     -- eerste dag van de maand
  capacity_minutes integer not null,
  proposal     jsonb not null,                    -- voorstellen incl. reden
  approved_content_ids uuid[] not null default '{}',
  created_at   timestamptz not null default now()
);

create table public.notification_preferences (
  creator_id    uuid primary key references public.creators(id) on delete cascade,
  enabled       boolean not null default true,
  max_per_week  smallint not null default 3 check (max_per_week between 0 and 20),
  min_relevance smallint not null default 55 check (min_relevance between 0 and 100),
  stages        text[] not null default '{samenwerking,concept,productie,publicatie,dag_zelf}',
  prep_defaults jsonb not null default '{"samenwerking":56,"concept":42,"productie":21,"publicatie":7,"dag_zelf":0}'
);

create table public.notifications_sent (            -- voorkomt dubbele meldingen
  creator_id  uuid not null references public.creators(id) on delete cascade,
  alert_key   text not null,                       -- `${eventId}:${start}:${stage}`
  sent_at     timestamptz not null default now(),
  dismissed   boolean not null default false,
  primary key (creator_id, alert_key)
);

-- ───────────── AI Content Council ─────────────
-- Alleen niet-geheime configuratie. API-sleutels staan in server-secrets (env/Vault), nooit hier.
create table public.ai_provider_configs (
  provider       text primary key check (provider in ('anthropic','openai')),
  model          text not null,
  input_usd_per_mtok  numeric(10,4) not null,
  output_usd_per_mtok numeric(10,4) not null,
  enabled        boolean not null default true,
  updated_at     timestamptz not null default now()
);

create table public.ai_budgets (
  creator_id           uuid primary key references public.creators(id) on delete cascade,
  monthly_budget_usd   numeric(8,2) not null default 25,
  council_monthly_limit integer not null default 40
);

create table public.ai_generation_jobs (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.creators(id) on delete cascade,
  mode          text not null check (mode in ('fast','smart','council')),
  brief         jsonb not null,
  brief_hash    text not null,                    -- cache-sleutel
  status        text not null check (status in ('klaar','mislukt')),
  final         jsonb,
  differences   jsonb not null default '[]',
  change_log    jsonb not null default '[]',
  open_questions jsonb not null default '[]',
  models_used   text[] not null default '{}',
  fallback_used text,
  verification  text not null default 'niet_geverifieerd',
  total_cost_usd numeric(10,4) not null default 0,
  error         text,
  content_item_id uuid references public.content_items(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.ai_generation_jobs (creator_id, created_at desc);
create index on public.ai_generation_jobs (creator_id, brief_hash);

create table public.ai_reviews (                    -- elke stap: voorstel, review, synthese
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.ai_generation_jobs(id) on delete cascade,
  step_name     text not null,
  kind          text not null check (kind in ('proposal','review','synthesis')),
  provider      text not null,
  model         text not null,
  review_of     text,
  output        jsonb,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(10,6) not null default 0,
  error         text,
  created_at    timestamptz not null default now()
);

create table public.user_feedback (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.creators(id) on delete cascade,
  subject     text not null,                       -- 'idea' | 'ai_job' | 'suggestion'
  subject_id  text not null,
  rating      smallint check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

-- ───────────── Row Level Security ─────────────
create or replace function public.owns_creator(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.creators c where c.id = cid and c.owner_id = auth.uid());
$$;

alter table public.creators enable row level security;
create policy creators_own on public.creators for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'creator_pillars','creator_event_relevance','seasonal_content_suggestions','idea_feedback',
    'content_items','content_plans','notification_preferences','notifications_sent',
    'ai_budgets','ai_generation_jobs','user_feedback'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id))', t || '_own', t);
  end loop;
end $$;

-- Kalender: gedeelde items leesbaar voor ingelogde gebruikers; eigen items alleen voor de eigenaar.
alter table public.seasonal_events enable row level security;
create policy events_read on public.seasonal_events for select to authenticated
  using (creator_id is null or public.owns_creator(creator_id));
create policy events_write_own on public.seasonal_events for all to authenticated
  using (creator_id is not null and public.owns_creator(creator_id))
  with check (creator_id is not null and public.owns_creator(creator_id));

alter table public.event_occurrences enable row level security;
create policy occ_read on public.event_occurrences for select to authenticated using (
  exists (select 1 from public.seasonal_events e where e.id = event_id and (e.creator_id is null or public.owns_creator(e.creator_id)))
);

alter table public.event_sources enable row level security;
create policy sources_read on public.event_sources for select to authenticated using (true);
alter table public.idea_templates enable row level security;
create policy templates_read on public.idea_templates for select to authenticated using (true);

-- AI-stappen: alleen via de job van de eigen creator.
alter table public.ai_reviews enable row level security;
create policy reviews_read on public.ai_reviews for select using (
  exists (select 1 from public.ai_generation_jobs j where j.id = job_id and public.owns_creator(j.creator_id))
);
-- Schrijven van jobs/reviews/prijzen gebeurt alleen server-side met de service role.
alter table public.ai_provider_configs enable row level security; -- geen policies = geen client-toegang
