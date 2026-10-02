# Interactive maps — setup and runbook

The `/map/` page renders map images from Supabase Storage with markers drawn over
them. Maps and markers are **public read**, same as lore articles. Only the DM can
create or change them.

This is phase one: the viewer. DM drawing and editing lands in a follow-up.

---

## One-time setup

### 1. Create the tables and bucket

Run `scripts/supabase-maps-schema.sql` in **Supabase Dashboard → SQL Editor**.

It depends on `touch_updated_at()` and `is_dm()` from `scripts/supabase-schema.sql`,
so run that first if you have not already.

It creates:

- `maps` — one row per map image
- `map_markers` — points and polygons belonging to a map
- a public Storage bucket `maps`, writable only by the DM

### 2. Upload a map image

**Storage → maps → Upload file.** Keep the filename simple; it becomes the
`storage_path`. For the city map, upload it as `arumas-city-map.jpeg`.

Note the image's real pixel dimensions. Every marker coordinate is in that pixel
space, so the numbers have to match the file you uploaded.

### 3. Seed the Aru'Mas map

Run `scripts/seed-arumas-map.sql`. It inserts the map row and 50 markers: 10
district polygons, 7 quarter polygons and 33 locations, with 43 of them linked to
their article. Re-running it is safe — the map upserts on slug and its markers are
replaced.

---

## Adding another map by hand

Until the DM editor ships, a new map is two inserts.

```sql
insert into maps (slug, title, description, storage_path, image_width, image_height, is_published)
values ('the-fend', 'The Fend', 'The farmland and Fendtowns beyond the walls.',
        'the-fend.jpeg', 3000, 2000, true);

insert into map_markers (map_id, kind, title, article_slug, geo_x, geo_y, color, group_name)
values ((select id from maps where slug = 'the-fend'),
        'point', 'Lamplight Tower', 'lamplight-tower', 1420, 880, '#c9a227', 'Landmarks');
```

Set `is_published = false` while you are still marking a map up. Unpublished maps
are invisible to everyone but you, which makes a useful staging area.

---

## Coordinates

**All coordinates in this database are pixels in the map image, measured from the
top-left corner.** One convention, everywhere.

This matters because World Anvil, which the Aru'Mas data came from, uses two
different ones:

| | World Anvil | Here |
|---|---|---|
| Point markers | `geoX`, `geoY` from the **bottom-left** | `geo_x`, `geo_y` from the top-left |
| Polygon vertices | `lat,lng` from the **bottom-left** — axis order reversed relative to its own points | `points: [[x, y], …]` from the top-left |

`scripts/seed-arumas-map.sql` was generated with both conversions already applied.
If you ever import from World Anvil again, convert on the way in rather than
compensating in the renderer. The first build of this page got the polygon axes
backwards, and the symptom was subtle: every shape looked plausible, just attached
to the wrong district.

A quick way to check an import is point-in-polygon — if the markers do not land
inside the districts they claim to be in, the transform is wrong, not the data.

---

## Marker tooltips

Hovering a marker shows a summary pulled from `/map-articles.json`, which
`src/map-articles.11ty.js` generates at build time from every article: title, URL
and a ~220 character excerpt.

The excerpt prefers a hand-written `description` in frontmatter and otherwise takes
the opening prose. It strips `{% dmonly %}` spoilers and blockquote callouts first,
so **nothing DM-only reaches the public map**. Only 24 of 233 articles currently
have a `description`; the rest fall back to their opening paragraph, which reads
fine.

To override the text for one marker without touching the article, set
`snippet_override` on that marker.

Clicking a marker opens its article in a new tab. A marker with no `article_slug`
is hoverable but not clickable.

---

## Files

| Path | Purpose |
|---|---|
| `scripts/supabase-maps-schema.sql` | Tables, RLS, Storage bucket |
| `scripts/seed-arumas-map.sql` | The Aru'Mas city map and its 50 markers |
| `src/map.njk` | The page |
| `src/assets/js/map.js` | Leaflet viewer |
| `src/map-articles.11ty.js` | Builds `/map-articles.json` for tooltips |
| `src/assets/css/main.css` | `.map-*` rules |

`templateFormats` in `.eleventy.js` gained `"11ty.js"` so the article index is
built at all. Without it Eleventy silently skips the file.

---

## Troubleshooting

**"No maps published yet"** — either no `maps` row has `is_published = true`, or
RLS is blocking the read. Check in the SQL Editor:
`select slug, is_published from maps;`

**The image does not appear but markers do** — `storage_path` does not match the
file in the bucket, or the bucket is not public. The bucket must be public;
`supabase-maps-schema.sql` sets that.

**Markers are in the wrong place** — check `image_width` / `image_height` against
the actual image. Markers are positioned relative to those numbers, so a map row
describing a different-sized image puts every marker off by the same ratio.

**Tooltips show titles but no summary** — `/map-articles.json` did not build, or
`article_slug` does not match any article. Open `/map-articles.json` directly and
search for the slug.
