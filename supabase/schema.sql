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

create table if not exists clicks (
  id bigserial primary key,
  app_id uuid not null references apps(id) on delete cascade,
  referrer text,
  user_agent text,
  clicked_at timestamptz not null default now()
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

create index if not exists idx_apps_creator on apps(creator_id);
create index if not exists idx_clicks_app_time on clicks(app_id, clicked_at desc);
create index if not exists idx_payments_creator on payments(creator_id, created_at desc);
