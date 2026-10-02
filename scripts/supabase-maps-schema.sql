-- ============================================================
-- Ahvantir Website — Interactive Maps Schema
-- Run once in Supabase Dashboard > SQL Editor, after supabase-schema.sql
--
-- Maps and their markers are PUBLIC read (no sign-in required), matching how
-- lore articles work. Writes are restricted to the DM via is_dm(), which is
-- defined in supabase-schema.sql.
-- ============================================================

-- ── Maps ────────────────────────────────────────────────────
-- One row per uploaded map image. The image itself lives in the public
-- Storage bucket 'maps'; storage_path is its key within that bucket.
--
-- image_width / image_height are the image's natural pixel dimensions. Marker
-- coordinates are stored in that same pixel space, so a map can be re-rendered
-- at any display size without touching its markers.
create table if not exists maps (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  description  text not null default '',
  storage_path text not null,
  image_width  integer not null check (image_width  > 0),
  image_height integer not null check (image_height > 0),
  sort_order   integer default 0,
  is_published boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

drop trigger if exists maps_updated_at on maps;
create trigger maps_updated_at
  before update on maps
  for each row execute function touch_updated_at();

-- ── Map markers ─────────────────────────────────────────────
-- Two shapes share this table:
--   kind = 'point' — a pin at (geo_x, geo_y)
--   kind = 'area'  — a polygon whose vertices are in points: [[x,y], [x,y], …]
--
-- Both coordinate forms are in the parent map's pixel space, origin top-left.
-- (World Anvil stores polygon vertices bottom-left and axis-swapped relative to
-- its own markers; the seed script converts. Everything in this table is one
-- consistent space.)
--
-- article_slug links the marker to a site article at /articles/<slug>/. It is
-- deliberately NOT a foreign key: articles are static files generated from the
-- Obsidian vault, not database rows, so the database cannot validate the slug.
-- A marker whose article has been renamed or removed still renders; the link
-- just 404s, which is visible and fixable rather than silently dropping data.
create table if not exists map_markers (
  id               uuid primary key default gen_random_uuid(),
  map_id           uuid references maps(id) on delete cascade not null,
  kind             text not null default 'point' check (kind in ('point', 'area')),
  title            text not null default 'Untitled',
  article_slug     text,
  snippet_override text,
  geo_x            double precision,
  geo_y            double precision,
  points           jsonb,
  color            text not null default '#c9a227',
  group_name       text not null default '',
  sort_order       integer default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),

  -- A point needs coordinates; an area needs vertices. Enforced here so a
  -- half-saved marker can never reach the client and break the renderer.
  constraint marker_geometry check (
    (kind = 'point' and geo_x is not null and geo_y is not null)
    or
    (kind = 'area'  and points is not null and jsonb_typeof(points) = 'array')
  )
);

create index if not exists map_markers_map_id_idx on map_markers (map_id);

drop trigger if exists map_markers_updated_at on map_markers;
create trigger map_markers_updated_at
  before update on map_markers
  for each row execute function touch_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table maps        enable row level security;
alter table map_markers enable row level security;

-- ── Public read ─────────────────────────────────────────────
-- No auth.uid() check: anonymous visitors read published maps, exactly as they
-- read articles. Unpublished maps stay invisible until the DM publishes them,
-- which doubles as a staging area for a map that is still being marked up.
create policy "published maps are public"
  on maps for select
  using (is_published = true);

create policy "markers of published maps are public"
  on map_markers for select
  using (
    exists (
      select 1 from maps m
      where m.id = map_markers.map_id
        and m.is_published = true
    )
  );

-- ── DM writes ───────────────────────────────────────────────
-- The DM sees everything (including unpublished) and is the only role that may
-- insert, update or delete. Players get no write path at all.
create policy "dm manages maps"
  on maps for all
  using (is_dm())
  with check (is_dm());

create policy "dm manages markers"
  on map_markers for all
  using (is_dm())
  with check (is_dm());

-- ============================================================
-- Storage bucket for map images
-- ============================================================

-- Public bucket: the images are rendered to anonymous visitors, so there is
-- nothing to gain from signed URLs here. Writes remain DM-only.
insert into storage.buckets (id, name, public)
values ('maps', 'maps', true)
on conflict (id) do nothing;

create policy "map images are public"
  on storage.objects for select
  using (bucket_id = 'maps');

create policy "dm uploads map images"
  on storage.objects for insert
  with check (bucket_id = 'maps' and is_dm());

create policy "dm updates map images"
  on storage.objects for update
  using (bucket_id = 'maps' and is_dm())
  with check (bucket_id = 'maps' and is_dm());

create policy "dm deletes map images"
  on storage.objects for delete
  using (bucket_id = 'maps' and is_dm());

-- ============================================================
-- Post-setup steps:
-- 1. Run this script in the SQL Editor.
-- 2. Upload a map image to the 'maps' bucket (Storage > maps).
-- 3. Insert a maps row pointing at it, with the image's real pixel dimensions.
--    scripts/seed-arumas-map.sql does both for the Aru'Mas city map.
-- 4. Set is_published = true when the map is ready to be seen.
-- ============================================================
