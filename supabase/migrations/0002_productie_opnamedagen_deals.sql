-- ContentFlow · productiebord, opnamedagen en samenwerkingen

-- Productiestatussen (kolommen van het bord). Oude waarden omzetten.
alter table public.content_items drop constraint if exists content_items_status_check;
update public.content_items set status = case status
  when 'gepland' then 'idee' when 'in_productie' then 'gefilmd' when 'klaar' then 'bewerkt' else status end;
alter table public.content_items add constraint content_items_status_check
  check (status in ('idee','script','gefilmd','bewerkt','gepubliceerd'));

alter table public.content_items
  add column if not exists location text check (location in ('keuken','sportschool','thuis','buiten','onderweg')),
  add column if not exists hooks text[],
  add column if not exists hashtags text[];
alter table public.content_items drop constraint if exists content_items_source_check;
alter table public.content_items add constraint content_items_source_check
  check (source in ('handmatig','seasonal','maandplanning','ai','deal'));

-- Samenwerkingen
create table public.deals (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creators(id) on delete cascade,
  brand            text not null,
  platform         text not null check (platform in ('influentials','join','direct','anders')),
  status           text not null check (status in ('aanbod','onderhandeling','akkoord','content_ingediend','live','gefactureerd','betaald','afgewezen')),
  fee_eur          numeric(10,2) check (fee_eur >= 0),
  deliverables     text not null default '',
  category         text not null default '',
  content_deadline date,
  live_date        date,
  exclusivity_category text,
  exclusivity_until    date,
  link             text,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  constraint exclusivity_complete check ((exclusivity_category is null) = (exclusivity_until is null))
);
create index on public.deals (creator_id, content_deadline);
alter table public.content_items add column if not exists deal_id uuid references public.deals(id) on delete set null;

-- Opnamedagen
create table public.shoot_days (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references public.creators(id) on delete cascade,
  shoot_date         date not null,
  minutes_available  integer not null check (minutes_available between 15 and 960),
  created_at         timestamptz not null default now()
);
create table public.shoot_day_items (
  shoot_day_id    uuid not null references public.shoot_days(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  primary key (shoot_day_id, content_item_id)
);

-- Toegang: alleen de eigen creator.
alter table public.deals enable row level security;
create policy deals_own on public.deals for all using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id));
alter table public.shoot_days enable row level security;
create policy shoot_days_own on public.shoot_days for all using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id));
alter table public.shoot_day_items enable row level security;
create policy shoot_day_items_own on public.shoot_day_items for all using (
  exists (select 1 from public.shoot_days s where s.id = shoot_day_id and public.owns_creator(s.creator_id))
) with check (
  exists (select 1 from public.shoot_days s where s.id = shoot_day_id and public.owns_creator(s.creator_id))
);
