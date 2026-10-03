-- ============================================================
-- Ahvantir Website — player map notes
-- Run once in Supabase Dashboard > SQL Editor, after supabase-maps-schema.sql
--
-- Pins a signed-in player drops on a map, with a private note attached. These
-- are PRIVATE TO THE PLAYER: nobody else sees them, including the DM. That is
-- the whole point of the feature, and it is enforced by RLS rather than by the
-- interface, so it holds even against someone querying the API directly with
-- the site's anon key.
--
-- Deliberately a separate table from map_markers rather than a flag on it.
-- map_markers is world-readable by design, and the surest way to keep a private
-- row out of a public response is for it never to live in the public table.
-- ============================================================

create table if not exists player_map_markers (
  id         uuid primary key default gen_random_uuid(),
  -- Defaults to the caller, so a client never has to say who it is. The RLS
  -- policy below would reject a mismatch anyway; this just removes the chance
  -- of writing the field wrongly.
  player_id  uuid references profiles(id) on delete cascade not null default auth.uid(),
  map_id     uuid references maps(id) on delete cascade not null,

  -- Same coordinate space as map_markers: pixels in the parent map's image,
  -- origin top-left. src/assets/js/map-coords.js is the only place that
  -- converts, for players exactly as for the DM.
  geo_x      double precision not null,
  geo_y      double precision not null,

  label      text not null default '',
  note       text not null default '',
  color      text not null default '#076cba',

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- An invalid colour renders as no fill, which looks identical to a failed
  -- save. Constrain it rather than debug it later.
  constraint player_marker_color_hex check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- Bounds so one player cannot fill the table from a text box. Generous
  -- enough that nobody writing a real note will meet them.
  constraint player_marker_label_len check (char_length(label) <= 120),
  constraint player_marker_note_len  check (char_length(note)  <= 4000)
);

-- Every read is "my pins on this map".
create index if not exists player_map_markers_owner_map_idx
  on player_map_markers (player_id, map_id);

drop trigger if exists player_map_markers_updated_at on player_map_markers;
create trigger player_map_markers_updated_at
  before update on player_map_markers
  for each row execute function touch_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table player_map_markers enable row level security;

-- One policy, every command, owner only. Matches player_notes,
-- player_bookmarks and player_scratchpad, which are private the same way.
--
-- No is_dm() exception on purpose. The DM can read every other map table, but
-- these are a player's own notes and the DM is not meant to see them. If that
-- is ever wanted it should be a deliberate change here, not an accident of a
-- broad policy.
drop policy if exists "players manage own map markers" on player_map_markers;
create policy "players manage own map markers"
  on player_map_markers for all
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

-- ============================================================
-- Checking it
--
--   set local role anon;
--   select count(*) from player_map_markers;   -- must be 0
--
-- And as a signed-in player, only their own rows come back. An anonymous
-- visitor gets an empty set rather than an error, because RLS filters; that is
-- why the client treats "no rows" as a real answer and not as a failure.
-- ============================================================
