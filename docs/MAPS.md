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

The editor below is the normal way. Doing it in SQL is still useful for seeding or scripting, and is two inserts.

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

## The DM editor

Sign in as the DM and open `/map/`. A **DM** bar appears at the right of the map
toolbar with three controls: **Edit mode**, **Publish map**, and **Upload map**.
Nobody else sees them, and nobody else downloads them: `map-editor.js` asks the
database `is_dm()` before it fetches the 290 KB drawing library, so a visitor
pays nothing for the editor existing.

### Back up first

Run `scripts/backup-map-data.sql` in the SQL Editor and save the result before a
long session. The 17 district polygons are 726 hand-traced vertices that are not
derived from anything and cannot be regenerated. Before phase 2 they only ever
changed through a file in git; now a drag changes the live row.

### Uploading a map

**Upload map** reads the image's real pixel dimensions in the browser and writes
them to the `maps` row, so the dimensions always match the file. Each upload
gets a unique storage key rather than overwriting, because overwriting a live
key would destroy the image every marker on that map is positioned against.

A new map starts unpublished. You can see and mark up unpublished maps; players
cannot. **Publish map** flips that, and flips back to **Unpublish map**.

### Drawing

**Edit mode** adds the Geoman toolbar at the top-left of the map:

| Tool | What it does |
|---|---|
| Marker | Click once to drop a point |
| Polygon | Click each corner, click the first corner again to close |
| Edit | Drag the corner handles; drag a midpoint handle to add a corner |
| Drag | Move a whole shape |
| Delete | Click a shape to remove it |

Every change saves on release. There is no save button for geometry, and no
unsaved state to lose. Each save raises a notice at the bottom of the screen,
green for saved and red for refused.

Self-intersection is blocked. If a corner you drag would cross another edge of
the same shape, the shape snaps back and the notice says why rather than letting
it look like a failed save.

### Linking an article

Click a marker in the sidebar list while in edit mode to open its panel: title,
article, group, summary override, colour.

The article dropdown is built from `/map-articles.json`, the same 240 entries the
tooltips use, so anything on the site can be linked and nothing else can. The
summary override is for when the article's own opening is the wrong thing to show
on hover; leave it empty and the article's opening is used.

**Save details** writes the panel. Geometry does not need it.

### Deleting

Deletion is soft. The row is stamped with `deleted_at`, the public policy hides
stamped rows, and the notice offers **Undo** for twelve seconds. After that the
row is still there: see the end of `scripts/backup-map-data.sql` for the query
that lists deleted markers and the update that brings one back.

This is deliberate. A district is ninety-odd vertices and there is no way to
redraw it faithfully, so a misclick in delete mode must not be final.

### When a save is refused

Postgres RLS **filters** rather than erroring. An expired session does not
produce a permission error on update; it produces zero rows changed and no
error, which a naive editor would render as a successful save. Every write here
treats zero rows changed as a failure and says so.

The same mechanism catches two tabs: each write is conditioned on the
`updated_at` it last read, so the second tab is refused rather than silently
discarding the first tab's work. Reload and redo the change.

---

## Testing the coordinate conversion

```bash
npm test
```

Round-trips all 726 polygon vertices and 33 points from the seed file through
`map-coords.js` ten times each and asserts they come back byte-identical, then
checks that the validation guards actually reject bad geometry.

Run it after touching `map-coords.js`. A one-pixel asymmetry between the two
directions does not break anything visibly; it moves every shape slightly
further toward one edge on each save, which looks like "the map is a bit off"
months later, after the original geometry is gone. The World Anvil import for
this map hit that class of bug and put 32 of 33 markers in the wrong district
while every shape still looked plausible.

The editor also runs `MapCoords.selfTest()` against the open map's height on
boot and refuses to enable editing if it fails.

### Exercising the editor without a database

`scripts/map-editor-harness.html` stands up the real `map.js` and
`map-editor.js` against an in-memory stand-in for Supabase, so the DM paths can
be driven without signing in or touching live data.

```bash
npm start
cp scripts/map-editor-harness.html _site/
```

Then open `http://localhost:8080/map-editor-harness.html`. It reports as the DM,
serves two maps (one unpublished) and two markers, and logs every write to
`window.__LOG` with the resulting rows in `window.__DB`.

It is not wired into `npm test`: it needs a browser and a hand on it. It is kept
because it found two faults that reading the code did not. The first was that
`pmIgnore` has to be a constructor option, not a property set afterwards. The
second was worse: Geoman attaches through Leaflet init hooks, so loading it
lazily after the map had already rendered left `map.pm` undefined and every
marker uneditable. Both looked correct on the page until something was clicked.

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
| `scripts/backup-map-data.sql` | Export every map and marker; restore notes |
| `scripts/test-map-coords.js` | `npm test` — coordinate round-trip check |
| `src/assets/js/map.js` | Leaflet viewer |
| `src/assets/js/map-coords.js` | The only place the two coordinate systems meet |
| `src/assets/js/map-editor.js` | DM editing; inert and undownloaded for everyone else |
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

**The DM bar does not appear** — you are signed in but `profiles.is_dm` is not
true for your account. Check with `select is_dm();` in the SQL Editor while
signed in as yourself.

**The drawing toolbar does not appear in edit mode** — the Geoman bundle was
blocked. The Content-Security-Policy in `src/_includes/layouts/base.njk` allows
scripts and styles from `cdn.jsdelivr.net` only, so Leaflet and Geoman both load
from there. A version bump needs its SRI hash updated in the same commit, or the
browser refuses the file silently apart from a console message.

**A save says it changed nothing** — either the session is no longer the DM, or
another tab saved that marker first. Both are real refusals, not glitches.
Reload the page and redo the change.
