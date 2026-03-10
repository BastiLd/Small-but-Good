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
alter table submission_requests add column if not exists submitted_with_account boolean not null default false;
alter table submission_requests add column if not exists account_email text;
alter table submission_requests add column if not exists account_user_id uuid;
alter table submission_requests add column if not exists creator_id uuid references creators(id) on delete set null;
alter table submission_requests add column if not exists deleted_at timestamptz;
alter table submission_requests add column if not exists restore_until timestamptz;
alter table submission_requests add column if not exists approved_intro_text text;
alter table submission_requests add column if not exists detail_sections jsonb not null default '[]'::jsonb;
alter table submission_requests add column if not exists external_button_label text;

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
grant select on public_creator_profiles to anon, authenticated;
grant select on public_submission_duplicates to anon, authenticated;

alter table creators enable row level security;
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
