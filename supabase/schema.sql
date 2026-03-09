create extension if not exists pgcrypto;

create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  stripe_account_id text,
  created_at timestamptz not null default now()
);

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
alter table interaction_events add column if not exists actor_email text;
alter table interaction_events add column if not exists actor_user_id uuid;

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

create table if not exists admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

create index if not exists idx_apps_creator on apps(creator_id);
create index if not exists idx_payments_creator on payments(creator_id, created_at desc);
create index if not exists idx_submission_requests_created_at on submission_requests(created_at desc);
create unique index if not exists idx_submission_requests_public_slug
  on submission_requests(public_slug)
  where public_slug is not null;
create index if not exists idx_submission_requests_account_email
  on submission_requests(account_email);
create index if not exists idx_interaction_events_created_at
  on interaction_events(created_at desc);
create index if not exists idx_interaction_events_type_created_at
  on interaction_events(event_type, created_at desc);
create index if not exists idx_interaction_events_actor_email
  on interaction_events(actor_email);

alter table submission_requests enable row level security;
alter table interaction_events enable row level security;
alter table admin_users enable row level security;

drop policy if exists public_submission_insert on submission_requests;
create policy public_submission_insert
on submission_requests
for insert
to anon, authenticated
with check (
  source = 'website'
  and status = 'pending'
);

drop policy if exists public_submission_select_approved on submission_requests;
create policy public_submission_select_approved
on submission_requests
for select
to anon, authenticated
using (status = 'approved');

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
