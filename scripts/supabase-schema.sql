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

-- Player: full CRUD on their own character's secret.
-- with check also verifies the character_id belongs to the caller, preventing
-- a player from attaching a secret to another player's character.
create policy "own secret"
  on character_secrets for all
  using (player_id = auth.uid())
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from characters c
      where c.id = character_secrets.character_id
        and c.player_id = auth.uid()
    )
  );

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

-- ── Character Images ─────────────────────────────────────────
-- Metadata for uploaded character portraits / art.
-- Actual files live in Supabase Storage bucket 'character-images'.
-- Storage path convention: {player_id}/{character_id}/{timestamp}.{ext}
create table if not exists character_images (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid references characters(id) on delete cascade not null,
  player_id    uuid references profiles(id)   on delete cascade not null,
  storage_path text not null,
  caption      text,
  sort_order   integer default 0,
  created_at   timestamptz default now()
);

alter table character_images enable row level security;

-- Player: full CRUD on their own character's images.
-- with check also verifies the character_id belongs to the caller, preventing
-- a player from attaching an image to another player's character.
create policy "own character images"
  on character_images for all
  using  (player_id = auth.uid())
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from characters c
      where c.id = character_images.character_id
        and c.player_id = auth.uid()
    )
  );

-- DM: read all
create policy "dm sees all character images"
  on character_images for select
  using (is_dm());

-- Other signed-in players: see images for public characters
create policy "public character image records"
  on character_images for select
  using (
    auth.uid() is not null and
    exists (
      select 1 from characters c
      where c.id = character_images.character_id
        and c.is_public = true
    )
  );

-- ============================================================
-- Storage bucket (run in SQL Editor after tables are created)
-- ============================================================

-- Create the private bucket for character images
insert into storage.buckets (id, name, public)
values ('character-images', 'character-images', false)
on conflict (id) do nothing;

-- Owner: upload / read / delete own files
create policy "own storage objects"
  on storage.objects for all
  using (
    bucket_id = 'character-images' and
    auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'character-images' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- DM: read all files in the bucket
create policy "dm reads all storage objects"
  on storage.objects for select
  using (bucket_id = 'character-images' and is_dm());

-- Other players: read files whose parent character is public
create policy "public character storage objects"
  on storage.objects for select
  using (
    bucket_id = 'character-images' and
    auth.uid() is not null and
    exists (
      select 1 from characters c
      where c.id::text = (storage.foldername(name))[2]
        and c.is_public = true
    )
  );

-- ── Profiles — column-level UPDATE restriction ───────────────
-- Revoke blanket UPDATE so clients cannot flip is_dm.
-- Only display_name may be updated from an authenticated session.
-- is_dm must be set manually in the Supabase Dashboard (or via a
-- SECURITY DEFINER function called by a privileged role).
revoke update on profiles from authenticated;
grant  update (display_name) on profiles to authenticated;

-- Allow all authenticated users to read the full profiles list
-- (needed so the messaging recipient-picker can populate the dropdown).
create policy "players read all profiles"
  on profiles for select
  using (auth.uid() is not null);

-- ── Messages ─────────────────────────────────────────────────
-- Created in the Dashboard (not via the original schema script).
-- Captured here so the full schema is reviewable and reproducible.
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  content      text not null default '',
  created_at   timestamptz default now(),
  read_at      timestamptz,
  -- DB-level guards: non-empty content, reasonable length cap, no self-messaging
  constraint messages_content_length  check (char_length(content) between 1 and 4000),
  constraint messages_no_self_message check (sender_id <> recipient_id)
);

alter table messages enable row level security;

-- Participants (sender or recipient) may read the thread
create policy "message participants can read"
  on messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Only send as yourself
create policy "send own messages"
  on messages for insert
  with check (sender_id = auth.uid());

-- Only the recipient may mark a message read, and only the read_at column
-- is writable (enforced by the column grant below).
create policy "recipient marks read"
  on messages for update
  using     (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Restrict UPDATE to read_at only — content, sender_id, etc. are immutable.
revoke update on messages from authenticated;
grant  update (read_at) on messages to authenticated;

-- Enable realtime delivery for the messages table
alter publication supabase_realtime add table messages;

-- ============================================================
-- Post-setup steps (do after running this script):
-- 1. Have Krys sign up at /player/login/ to create their account
-- 2. In Supabase Dashboard > Table Editor > profiles,
--    find Krys's row and set is_dm = true
-- ============================================================
