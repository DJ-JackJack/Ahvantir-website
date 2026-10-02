-- ============================================================
-- Ahvantir — map data backup
--
-- Run this in Supabase Dashboard > SQL Editor and save the single result cell
-- to a file. Do it before a long marking session, and after any session where
-- you reshaped districts.
--
-- Why it matters: the 17 district polygons were traced by hand from the World
-- Anvil map, 726 vertices in total. They are not derived from anything and
-- cannot be regenerated. Until the editor existed they were safe because the
-- only copy of them that ever changed was a file in git; now a drag in edit
-- mode changes the live row.
--
-- This reads EVERY row, including unpublished maps and soft-deleted markers,
-- so a restore from it is complete. Run it as the DM: the RLS policies filter
-- the output for anyone else.
-- ============================================================

select jsonb_pretty(jsonb_build_object(
  'exported_at', now(),
  'maps', (
    select coalesce(jsonb_agg(to_jsonb(m) order by m.sort_order, m.title), '[]'::jsonb)
    from maps m
  ),
  'markers', (
    select coalesce(jsonb_agg(to_jsonb(k) order by k.map_id, k.sort_order, k.title), '[]'::jsonb)
    from map_markers k
  )
)) as backup;

-- ── Restoring ───────────────────────────────────────────────
-- Paste the saved JSON in place of the $$…$$ literal below and run it. Rows are
-- matched on their primary key: anything still present is reset to the backed-up
-- values, anything deleted since is recreated with its original id, and rows
-- created since the backup are left alone rather than dropped.
--
-- Re-read what this will overwrite before running it.
--
-- with snapshot as (select $$PASTE_THE_JSON_HERE$$::jsonb as doc)
-- insert into maps
--   select * from jsonb_populate_recordset(
--     null::maps, (select doc -> 'maps' from snapshot))
--   on conflict (id) do update set
--     slug = excluded.slug, title = excluded.title,
--     description = excluded.description, storage_path = excluded.storage_path,
--     image_width = excluded.image_width, image_height = excluded.image_height,
--     sort_order = excluded.sort_order, is_published = excluded.is_published;
--
-- with snapshot as (select $$PASTE_THE_JSON_HERE$$::jsonb as doc)
-- insert into map_markers
--   select * from jsonb_populate_recordset(
--     null::map_markers, (select doc -> 'markers' from snapshot))
--   on conflict (id) do update set
--     map_id = excluded.map_id, kind = excluded.kind, title = excluded.title,
--     article_slug = excluded.article_slug,
--     snippet_override = excluded.snippet_override,
--     geo_x = excluded.geo_x, geo_y = excluded.geo_y, points = excluded.points,
--     color = excluded.color, group_name = excluded.group_name,
--     sort_order = excluded.sort_order, deleted_at = excluded.deleted_at;

-- ── Undoing a delete without a backup ───────────────────────
-- Deletion from the editor is soft: the row is stamped, not removed. The Undo
-- button on the toast clears the stamp, but the stamp stays clearable forever.
-- To see what has been deleted on a map:
--
--   select id, title, kind, deleted_at from map_markers
--   where deleted_at is not null order by deleted_at desc;
--
-- To bring one back:
--
--   update map_markers set deleted_at = null where id = '…';
