create extension if not exists pgcrypto;

create or replace function public.slugify_text(input text)
returns text
language sql
immutable
as $$
  select left(
    trim(
      both '-'
      from regexp_replace(
        lower(
          translate(coalesce(input, ''), 'äöüßÄÖÜ', 'aoussAOU')
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    ),
    60
  );
$$;

create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  stripe_account_id text,
  created_at timestamptz not null default now()
);

alter table creators add column if not exists auth_user_id uuid;
alter table creators add column if not exists slug text;
alter table creators add column if not exists bio text;

create table if not exists apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  creator_id uuid not null references creators(id) on delete cascade,
  name text not null,
  short_description text,
  long_description text,
  website_url text,
  category text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table apps add column if not exists card_image_url text;
alter table apps add column if not exists card_image_scale double precision not null default 1;
alter table apps add column if not exists intro_text text;
alter table apps add column if not exists detail_sections jsonb not null default '[]'::jsonb;
alter table apps add column if not exists external_button_label text;
alter table apps add column if not exists platform text;
alter table apps add column if not exists platform_label text;
alter table apps add column if not exists type text;
alter table apps add column if not exists type_label text;
alter table apps add column if not exists feed_order integer not null default 100;
alter table apps drop constraint if exists apps_card_image_scale_check;
alter table apps add constraint apps_card_image_scale_check
  check (card_image_scale >= 1 and card_image_scale <= 2.4);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references apps(id) on delete set null,
  creator_id uuid references creators(id) on delete set null,
  stripe_payment_intent_id text unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  status text not null default 'requires_payment_method',
  created_at timestamptz not null default now()
);

create table if not exists submission_requests (
  id uuid primary key default gen_random_uuid(),
  creator_name text not null,
  email text not null,
  project_name text not null,
  website_url text,
  description text not null,
  source text not null default 'website',
  created_at timestamptz not null default now()
);

alter table submission_requests add column if not exists status text not null default 'pending';
alter table submission_requests add column if not exists reviewed_at timestamptz;
alter table submission_requests add column if not exists approved_at timestamptz;
alter table submission_requests add column if not exists public_slug text;
alter table submission_requests add column if not exists card_image_url text;
alter table submission_requests add column if not exists card_image_scale double precision not null default 1;
alter table submission_requests add column if not exists submitted_with_account boolean not null default false;
alter table submission_requests add column if not exists account_email text;
alter table submission_requests add column if not exists account_user_id uuid;
alter table submission_requests add column if not exists creator_id uuid references creators(id) on delete set null;
alter table submission_requests add column if not exists deleted_at timestamptz;
alter table submission_requests add column if not exists restore_until timestamptz;
alter table submission_requests add column if not exists approved_intro_text text;
alter table submission_requests add column if not exists detail_sections jsonb not null default '[]'::jsonb;
alter table submission_requests add column if not exists external_button_label text;
alter table submission_requests drop constraint if exists submission_requests_card_image_scale_check;
alter table submission_requests add constraint submission_requests_card_image_scale_check
  check (card_image_scale >= 1 and card_image_scale <= 2.4);

create table if not exists interaction_events (
  id bigserial primary key,
  item_id text not null,
  item_title text,
  item_source text not null default 'local',
  event_type text not null,
  route_path text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table interaction_events add column if not exists actor_email text;
alter table interaction_events add column if not exists actor_user_id uuid;

create table if not exists admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_creators_auth_user_id
  on creators(auth_user_id)
  where auth_user_id is not null;

create unique index if not exists idx_creators_slug
  on creators(slug)
  where slug is not null;

create index if not exists idx_apps_creator on apps(creator_id);
create index if not exists idx_apps_status_feed_order on apps(status, feed_order, created_at desc);
create index if not exists idx_payments_creator on payments(creator_id, created_at desc);
create index if not exists idx_submission_requests_created_at on submission_requests(created_at desc);
create unique index if not exists idx_submission_requests_public_slug
  on submission_requests(public_slug)
  where public_slug is not null;
create index if not exists idx_submission_requests_account_email
  on submission_requests(account_email);
create index if not exists idx_submission_requests_creator_id
  on submission_requests(creator_id);
create index if not exists idx_submission_requests_restore_until
  on submission_requests(restore_until)
  where deleted_at is not null;
create index if not exists idx_interaction_events_created_at
  on interaction_events(created_at desc);
create index if not exists idx_interaction_events_type_created_at
  on interaction_events(event_type, created_at desc);
create index if not exists idx_interaction_events_actor_email
  on interaction_events(actor_email);

drop view if exists public_projects;
create view public_projects as
select
  sr.id,
  sr.project_name,
  sr.description,
  coalesce(nullif(btrim(sr.approved_intro_text), ''), sr.description) as intro_text,
  sr.website_url,
  sr.card_image_url,
  coalesce(sr.card_image_scale, 1) as card_image_scale,
  coalesce(sr.detail_sections, '[]'::jsonb) as detail_sections,
  sr.external_button_label,
  coalesce(
    sr.public_slug,
    public.slugify_text(sr.project_name) || '-' || substring(replace(sr.id::text, '-', '') from 1 for 8)
  ) as slug,
  sr.approved_at,
  c.slug as creator_slug,
  c.display_name as creator_display_name
from submission_requests sr
left join creators c on c.id = sr.creator_id
where sr.status = 'approved'
  and sr.deleted_at is null;

drop view if exists public_apps;
create view public_apps as
select
  a.id,
  a.slug,
  a.name,
  a.short_description,
  coalesce(nullif(btrim(a.long_description), ''), a.short_description) as long_description,
  coalesce(nullif(btrim(a.intro_text), ''), coalesce(nullif(btrim(a.long_description), ''), a.short_description)) as intro_text,
  a.website_url,
  a.card_image_url,
  coalesce(a.card_image_scale, 1) as card_image_scale,
  coalesce(a.detail_sections, '[]'::jsonb) as detail_sections,
  a.external_button_label,
  a.platform,
  a.platform_label,
  a.type,
  a.type_label,
  a.feed_order,
  a.created_at,
  c.slug as creator_slug,
  c.display_name as creator_display_name
from apps a
left join creators c on c.id = a.creator_id
where a.status = 'published';

drop view if exists public_feed_projects;
create view public_feed_projects as
select
  'app'::text as source,
  a.id::text as id,
  a.slug,
  a.name as title,
  a.short_description as description,
  a.intro_text,
  a.website_url,
  a.card_image_url,
  a.card_image_scale,
  a.detail_sections,
  a.external_button_label,
  a.platform,
  a.platform_label,
  a.type,
  a.type_label,
  a.feed_order,
  a.created_at as published_at,
  a.creator_slug,
  a.creator_display_name
from public_apps a
union all
select
  'submission'::text as source,
  p.id::text as id,
  p.slug,
  p.project_name as title,
  p.description,
  p.intro_text,
  p.website_url,
  p.card_image_url,
  p.card_image_scale,
  p.detail_sections,
  p.external_button_label,
  'community'::text as platform,
  'Community'::text as platform_label,
  'submitted_project'::text as type,
  'Freigegeben'::text as type_label,
  1000 as feed_order,
  p.approved_at as published_at,
  p.creator_slug,
  p.creator_display_name
from public_projects p;

drop view if exists public_creator_profiles;
create view public_creator_profiles as
select
  id,
  slug,
  display_name,
  bio,
  created_at
from creators
where slug is not null;

drop view if exists public_submission_duplicates;
create view public_submission_duplicates as
select
  id,
  project_name,
  website_url,
  status,
  created_at
from submission_requests
where status in ('pending', 'approved')
  and deleted_at is null;

grant select on public_projects to anon, authenticated;
grant select on public_apps to anon, authenticated;
grant select on public_feed_projects to anon, authenticated;
grant select on public_creator_profiles to anon, authenticated;
grant select on public_submission_duplicates to anon, authenticated;

alter table creators enable row level security;
alter table apps enable row level security;
alter table submission_requests enable row level security;
alter table interaction_events enable row level security;
alter table admin_users enable row level security;

drop policy if exists creator_self_select on creators;
create policy creator_self_select
on creators
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or lower(email) = lower(auth.email())
);

drop policy if exists creator_self_insert on creators;
create policy creator_self_insert
on creators
for insert
to authenticated
with check (
  auth_user_id = auth.uid()
  and lower(email) = lower(auth.email())
);

drop policy if exists creator_self_update on creators;
create policy creator_self_update
on creators
for update
to authenticated
using (
  auth_user_id = auth.uid()
  or lower(email) = lower(auth.email())
)
with check (
  auth_user_id = auth.uid()
  and lower(email) = lower(auth.email())
);

drop policy if exists public_submission_insert on submission_requests;
create policy public_submission_insert
on submission_requests
for insert
to anon, authenticated
with check (
  source = 'website'
  and status = 'pending'
);

drop policy if exists creator_submission_select on submission_requests;
create policy creator_submission_select
on submission_requests
for select
to authenticated
using (
  lower(email) = lower(auth.email())
  or lower(coalesce(account_email, '')) = lower(auth.email())
  or account_user_id = auth.uid()
  or creator_id in (
    select id
    from creators
    where creators.auth_user_id = auth.uid()
  )
);

drop policy if exists admin_submission_select on submission_requests;
create policy admin_submission_select
on submission_requests
for select
to authenticated
using (
  exists (
    select 1
    from admin_users
    where admin_users.email = auth.email()
  )
);

drop policy if exists admin_submission_update on submission_requests;
create policy admin_submission_update
on submission_requests
for update
to authenticated
using (
  exists (
    select 1
    from admin_users
    where admin_users.email = auth.email()
  )
)
with check (
  exists (
    select 1
    from admin_users
    where admin_users.email = auth.email()
  )
);

drop policy if exists creator_submission_update on submission_requests;
create policy creator_submission_update
on submission_requests
for update
to authenticated
using (
  status = 'approved'
  and (
    lower(email) = lower(auth.email())
    or lower(coalesce(account_email, '')) = lower(auth.email())
    or account_user_id = auth.uid()
    or creator_id in (
      select id
      from creators
      where creators.auth_user_id = auth.uid()
    )
  )
)
with check (
  status = 'approved'
  and (
    lower(email) = lower(auth.email())
    or lower(coalesce(account_email, '')) = lower(auth.email())
    or account_user_id = auth.uid()
    or creator_id in (
      select id
      from creators
      where creators.auth_user_id = auth.uid()
    )
  )
);

drop policy if exists creator_app_select on apps;
create policy creator_app_select
on apps
for select
to authenticated
using (
  creator_id in (
    select id
    from creators
    where creators.auth_user_id = auth.uid()
       or lower(creators.email) = lower(auth.email())
  )
);

drop policy if exists admin_app_select on apps;
create policy admin_app_select
on apps
for select
to authenticated
using (
  exists (
    select 1
    from admin_users
    where admin_users.email = auth.email()
  )
);

drop policy if exists admin_app_update on apps;
create policy admin_app_update
on apps
for update
to authenticated
using (
  exists (
    select 1
    from admin_users
    where admin_users.email = auth.email()
  )
)
with check (
  exists (
    select 1
    from admin_users
    where admin_users.email = auth.email()
  )
);

drop policy if exists public_interaction_insert on interaction_events;
create policy public_interaction_insert
on interaction_events
for insert
to anon, authenticated
with check (
  event_type in ('page_view', 'detail_view', 'intro_open', 'external_click', 'magic_link_request')
);

drop policy if exists admin_interaction_select on interaction_events;
create policy admin_interaction_select
on interaction_events
for select
to authenticated
using (
  exists (
    select 1
    from admin_users
    where admin_users.email = auth.email()
  )
);

drop policy if exists admin_user_self_select on admin_users;
create policy admin_user_self_select
on admin_users
for select
to authenticated
using (email = auth.email());

insert into creators (email, display_name, slug, bio)
values (
  'bastian.klaus2010@gmail.com',
  'Bastian Klaus',
  'bastian-klaus',
  'Creator hinter CuratedHub.'
)
on conflict (email) do update
set slug = coalesce(creators.slug, excluded.slug),
    bio = coalesce(creators.bio, excluded.bio);

insert into apps (
  slug,
  creator_id,
  name,
  short_description,
  long_description,
  website_url,
  category,
  status,
  card_image_url,
  card_image_scale,
  intro_text,
  detail_sections,
  external_button_label,
  platform,
  platform_label,
  type,
  type_label,
  feed_order
)
values
  (
    'mfu-nexus-battle',
    (select id from creators where lower(email) = lower('bastian.klaus2010@gmail.com') limit 1),
    'MFU Nexus Battle',
    'Marvel-Kartenkämpfe, Missionen und Story-Mode auf Discord.',
    'Das ist mein Bot.
Er ist für ein Marvel-Kartenspiel gemacht.
Du kannst mit den Karten gegen Freunde oder gegen den Bot kämpfen, auf Missionen gehen und ein Story-Mode ist ebenfalls in Arbeit.
Mehr Infos gibt es auf dem Server. Wenn du Interesse hast, komm gern in die Marvel-Community.',
    'https://discord.gg/QFrGdyaGPj',
    'discord',
    'published',
    '/images/Logo_Nexus_Battle.png',
    1,
    'Das ist mein Bot.
Er ist für ein Marvel-Kartenspiel gemacht.
Du kannst mit den Karten gegen Freunde oder gegen den Bot kämpfen, auf Missionen gehen und ein Story-Mode ist ebenfalls in Arbeit.
Mehr Infos gibt es auf dem Server. Wenn du Interesse hast, komm gern in die Marvel-Community.',
    '[
      {
        "id": "mfu-story",
        "heading": "Was dich erwartet",
        "text": "Das Projekt verbindet Marvel-Kartenkämpfe mit Missionen und einem Story-Mode. Alles ist darauf ausgelegt, dass man direkt auf Discord loslegen kann."
      },
      {
        "id": "mfu-features",
        "heading": "Hauptfunktionen",
        "text": "1v1-Kartenkämpfe gegen Freunde oder den Bot\nTägliche Belohnungen und Kartenfortschritt\nMissionsmodus mit Belohnungen\nInteraktiver Story-Mode (in Arbeit)"
      },
      {
        "id": "mfu-commands",
        "heading": "Wichtige Befehle",
        "text": "/täglich - Hole deine tägliche Belohnung ab.\n/mission - Schicke dein Team auf eine Mission.\n/geschichte - Starte eine interaktive Story.\n/kampf - Kämpfe im 1v1 gegen Spieler oder Bot.\n/sammlung - Zeige deine Karten-Sammlung.\n/verbessern - Verstärke deine Karten mit Infinitydust.\n/anfang - Startmenü mit Schnellzugriff."
      }
    ]'::jsonb,
    'Zum Discord-Server',
    'discord',
    'Discord',
    'discord_bot',
    'Discord-Bot',
    10
  ),
  (
    'marvel-fan-universe-app',
    (select id from creators where lower(email) = lower('bastian.klaus2010@gmail.com') limit 1),
    'Marvel Fan Universe App',
    'Marvel-Film-News, Charakter-Infos und Post-Credit-Hinweise.',
    'Marvel Film News
Marvel Film Infos

Tippe auf den Film und du erfährst, ob es eine Post-Credit-Scene gibt und ob es mehrere gibt,
damit du weißt, ob du warten musst oder direkt am Ende des Filmes gehen kannst.

Du willst Infos zu einem Charakter, kein Problem.
Suche ihn und du bekommst alle Infos, die du brauchst.

Comic- und Game-Infos kommen bald dazu.',
    null,
    'app',
    'published',
    '/images/MFU-App.png',
    1,
    'Marvel Film News
Marvel Film Infos

Tippe auf den Film und du erfährst, ob es eine Post-Credit-Scene gibt und ob es mehrere gibt,
damit du weißt, ob du warten musst oder direkt am Ende des Filmes gehen kannst.

Du willst Infos zu einem Charakter, kein Problem.
Suche ihn und du bekommst alle Infos, die du brauchst.

Comic- und Game-Infos kommen bald dazu.',
    '[
      {
        "id": "mfu-app-overview",
        "heading": "Was die App macht",
        "text": "Die App bündelt Marvel-Film-News, Charakter-Infos und Post-Credit-Hinweise in einer Oberfläche."
      },
      {
        "id": "mfu-app-features",
        "heading": "Die wichtigsten Inhalte",
        "text": "Marvel Film News\nMarvel Film Infos\nPost-Credit-Scene-Hinweise pro Film\nCharaktersuche mit allen wichtigen Infos\nComic- und Game-Infos kommen bald dazu."
      }
    ]'::jsonb,
    'Demnächst verfügbar',
    'app',
    'App',
    'fan_app',
    'Fan-App',
    20
  ),
  (
    'perryrat',
    (select id from creators where lower(email) = lower('bastian.klaus2010@gmail.com') limit 1),
    'PerryRat',
    'Das ist ein Freund von mir, der richtig coole Animationen macht und richtig gut Videos bearbeiten kann. Schaut euch gerne sein Projekt an!',
    'Das ist ein Freund von mir, der richtig coole Animationen macht und richtig gut Videos bearbeiten kann. Schaut euch gerne sein Projekt an!',
    'https://www.youtube.com/@Perryrat',
    'youtube',
    'published',
    '/images/Perry-Rat_notinvbackg.png',
    1,
    'Das ist ein Freund von mir, der richtig coole Animationen macht und richtig gut Videos bearbeiten kann. Schaut euch gerne sein Projekt an!',
    '[
      {
        "id": "perryrat-overview",
        "heading": "Kanalprofil",
        "text": "PerryRat ist ein Kanal mit Animationen und kreativ bearbeiteten Videos."
      },
      {
        "id": "perryrat-gallery",
        "heading": "Einblicke",
        "text": "Hier bekommst du einen Eindruck von den Videos und dem Stil des Kanals.",
        "imageUrl": "/images/Perry Videos.png",
        "imageAlt": "Eine Auswahl von Videos vom PerryRat-Kanal"
      }
    ]'::jsonb,
    'Zum YouTube-Kanal',
    'youtube',
    'YouTube',
    'creator_channel',
    'Animationskanal',
    30
  )
on conflict (slug) do update
set
  creator_id = excluded.creator_id,
  name = excluded.name,
  short_description = excluded.short_description,
  long_description = excluded.long_description,
  website_url = excluded.website_url,
  category = excluded.category,
  status = excluded.status,
  card_image_url = excluded.card_image_url,
  card_image_scale = excluded.card_image_scale,
  intro_text = excluded.intro_text,
  detail_sections = excluded.detail_sections,
  external_button_label = excluded.external_button_label,
  platform = excluded.platform,
  platform_label = excluded.platform_label,
  type = excluded.type,
  type_label = excluded.type_label,
  feed_order = excluded.feed_order;
