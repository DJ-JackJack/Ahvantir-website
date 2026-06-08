-- ============================================================
-- Ahvantir Website — Phase 2 Database Schema
-- Run once in Supabase Dashboard > SQL Editor
-- ============================================================

-- ── Profiles ────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid references auth.users primary key,
  display_name text not null,
  is_dm        boolean default false,
  created_at   timestamptz default now()
);

-- Auto-create a profile row when a user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper used by RLS policies to check if the current user is the DM
create or replace function is_dm()
returns boolean language sql security definer stable as $$
  select coalesce((select is_dm from profiles where id = auth.uid()), false);
$$;

-- ── Characters ──────────────────────────────────────────────
create table if not exists characters (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid references profiles(id) on delete cascade not null,
  is_public  boolean default false,
  data       jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at on row changes
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists characters_updated_at on characters;
create trigger characters_updated_at
  before update on characters
  for each row execute function touch_updated_at();

-- ── Character Secrets ────────────────────────────────────────
-- One row per character: hidden background details
create table if not exists character_secrets (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid references characters(id) on delete cascade,
  player_id    uuid references profiles(id) on delete cascade not null,
  content      text not null default '',
  is_revealed  boolean default false,  -- false = hidden from other players
  created_at   timestamptz default now()
);

-- ── Campaign Notes ───────────────────────────────────────────
-- Always private — no DM access policy
create table if not exists campaign_notes (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid references profiles(id) on delete cascade not null,
  title      text not null default 'Untitled',
  content    text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists notes_updated_at on campaign_notes;
create trigger notes_updated_at
  before update on campaign_notes
  for each row execute function touch_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

-- ── Profiles ────────────────────────────────────────────────
alter table profiles enable row level security;

create policy "own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "dm reads all profiles"
  on profiles for select
  using (is_dm());

-- ── Characters ──────────────────────────────────────────────
alter table characters enable row level security;

create policy "own characters"
  on characters for all
  using (player_id = auth.uid())
  with check (player_id = auth.uid());

create policy "public chars readable"
  on characters for select
  using (is_public = true and auth.uid() is not null);

create policy "dm sees all characters"
  on characters for select
  using (is_dm());

-- ── Character Secrets ────────────────────────────────────────
alter table character_secrets enable row level security;

-- Player: full CRUD on their own character's secret
create policy "own secret"
  on character_secrets for all
  using (player_id = auth.uid())
  with check (player_id = auth.uid());

-- DM: always sees all secrets (even unrevealed ones)
create policy "dm sees all secrets"
  on character_secrets for select
  using (is_dm());

-- Other players: see only when the player has revealed it
create policy "revealed secrets"
  on character_secrets for select
  using (is_revealed = true and auth.uid() is not null and player_id <> auth.uid());

-- ── Campaign Notes ───────────────────────────────────────────
alter table campaign_notes enable row level security;

-- Notes are always fully private — no DM access intentionally
create policy "own notes"
  on campaign_notes for all
  using (player_id = auth.uid())
  with check (player_id = auth.uid());

-- ============================================================
-- Post-setup steps (do after running this script):
-- 1. Have Krys sign up at /player/login/ to create their account
-- 2. In Supabase Dashboard > Table Editor > profiles,
--    find Krys's row and set is_dm = true
-- ============================================================
