# Pixel Art Library: Instructions for Claude

This project stores pixel art for video games as **palette-indexed JSON data**. Creating an asset
means writing a JSON file under `library/`. The viewer picks it up automatically. No code changes
are needed.

One asset per file: `library/<folder>/<asset-name>.json`. The id is the path without `.json`
(for example `cats/cat-8-color`). Every asset has a `"type"`: `"image"` for a still,
`"spritesheet"` for a character's animations, or `"tileset"` for autotiling map terrain.

## Palette (shared by all types)

- 1 to 256 entries. **An entry's position in the array is its color index.**
- `color` is `#rrggbb` or `#rrggbbaa`. Give every entry a `name` that describes its role.
- Index 0 is `transparent` (`#00000000`) unless the asset needs an opaque background. It counts
  toward the palette size.
- Size the palette to the asset:
  - Small sprites and icons (≤ 32 px): 4 to 16 colors.
  - Characters and detailed props: 16 to 32.
  - Environment tilesets meant to read as a dense, lit scene: **32 to 64**. A 16-color city
    looks flat because it can't do both a full value ramp and accents.
- Organise colors as **ramps**, not as one-off colors. A ramp is 4 to 8 steps of one material,
  dark to light, with the hue shifting slightly as it goes (cooler in shadow, warmer or more
  saturated in light). Name entries `<ramp>-<step>`, e.g. `concrete-0` … `concrete-6`.
- Every material uses its own ramp: concrete, asphalt, metal, glass, plus one ramp per light
  color. Don't borrow a step from another ramp just because the value matches.

### Value structure

Readability comes from value (light vs dark) before hue. Decide the value plan first:

- **Top faces are lighter than side faces** (light comes from above). The right face is usually
  the darkest, the left one in between.
- **Lower is darker.** Street level sits in shadow; walkway decks and roofs catch the light.
  Darken ground tiles a step or two compared with the same material higher up.
- **Accents are rare.** Saturated, bright colors (neon, lit signs, screens) go on a very small
  share of pixels. Their value only reads because everything around them is dark and
  desaturated. If more than a few percent of a frame is saturated, it stops glowing.
- Lit windows follow a pattern, not a uniform grid: some floors dark, some partly lit, a
  few bright, warm and cool mixed.

### Clean surfaces, not noise

Noise is the most common way generated pixel art fails. Detail comes from **structure**, never
from texture.

- **A flat plane is mostly one color.** A walkway deck, a roof, a wall face: one base color
  covering most of it, with lit and shadowed parts as large solid areas. Shading comes from face
  direction and large-scale light, not from per-pixel variation.
- **Gradients are bands, not dither.** To change value across a surface, use 2 to 4 adjacent
  ramp steps in wide, clean bands (a lighter strip along the lit edge, darker toward the
  shadowed end). Need a smoother gradient? Add ramp steps. That's what the larger palette is
  for.
- **No dithering by default.** No checkerboards, no random speckle, no noise fills. Dithering is
  allowed only where it was asked for, or for a deliberate transition across a large area,
  and then as an ordered pattern inside one 1–2 px band.
- **Every detail pixel is something.** It has to be a panel seam, an edge highlight, a rivet,
  a railing post, a crack, a stain. If you can't name what a pixel represents, it's noise:
  make it the base color.
- **Edges carry the form.** Use a 1 px highlight on edges facing the light (top edge of a deck,
  roof parapet, railing top), a 1 px dark line under overhangs and where planes meet, and a
  clean silhouette. Crisp edges plus flat planes read as "modern pixel art". Noise plus soft
  edges reads as a filter.
- **Panels and seams are sparse lines.** On a walkway deck, a seam every 8–16 px, one ramp step
  darker than the deck, running along the grid. Same on walls and roofs.
- **Grime is shapes, not speckle.** A few streaks 1–2 px wide and several px long running down
  from ledges and windows, a darker patch at the base of walls, all at most one ramp step from
  the base color. A handful per tile, not a sprinkle over every surface.
- **Contrast follows importance.** Strong contrast goes on silhouettes, edges and light sources.
  Surfaces in between stay low-contrast so the eye isn't pulled everywhere at once.

Self-check: in a rendered crop, count the **orphan pixels**, those whose color matches none of
their 4 neighbours. Outside deliberate small details (lights, rivets, people), there should be
almost none. A scatter of orphans across a surface means noise: remove it.

## Image

```json
{
  "type": "image",
  "name": "Cat (4 colors)",
  "width": 8,
  "height": 8,
  "palette": [
    { "name": "transparent", "color": "#00000000" },
    { "name": "outline",     "color": "#2a1e1a" }
  ],
  "pixels": [
    [0, 1, 0, 0, 0, 0, 1, 0],
    ...one array per row, top to bottom...
  ]
}
```

`pixels[y][x]` is a palette index: exactly `height` rows, each exactly `width` long (1 to 1024).

## Sprite sheet

All the animations of one character, sharing a frame size and palette. It exports as one PNG
with **one row per animation** and **one column per frame**, plus a JSON file of frame
rectangles and timings for a game engine.

```json
{
  "type": "spritesheet",
  "name": "Grey Tabby (side view)",
  "frameWidth": 16,
  "frameHeight": 16,
  "palette": [ ... ],
  "animations": [
    {
      "name": "idle",
      "frameDurationMs": 400,
      "loop": true,
      "frames": [
        { "durationMs": 600, "pixels": [ ...frameHeight rows of frameWidth indices... ] },
        { "pixels": [ ... ] }
      ]
    }
  ]
}
```

- Animation `name`s are unique; they are the keys a game looks animations up by.
- `frameDurationMs` is the default per frame. An optional per-frame `durationMs` holds key poses
  (an idle pause, a jump apex).
- `loop`: `true` for cycles (idle, walk, run), `false` for one-shots (jump, attack, hurt). The
  viewer replays one-shots after a short pause.
- Put the idle animation first: it is the one the gallery thumbnail plays.

Game-sprite conventions:

- Every animation of a character faces the same way (usually right; games mirror it for left).
- Keep the feet on the same baseline row across ground animations, so the sprite doesn't jitter
  when the game switches animations. Jump poses may rise a few pixels within the frame.
- Build frames from shared parts (body, tail variants, leg poses) so the character stays
  consistent between animations.

## Tileset

Autotiling terrains for tile maps. Each cell's tile is chosen by a **4-bit neighbour mask**:
which of its grid neighbours share its terrain, N=1, E=2, S=4, W=8. So every terrain needs a
tile for each mask 0–15. Cells beyond the map edge count as filled.

```json
{
  "type": "tileset",
  "name": "Meadow Island (top-down)",
  "projection": { "type": "topdown" },
  "tileWidth": 16,
  "tileHeight": 16,
  "palette": [ ... ],
  "background": { "pixels": [ ... ] },
  "terrains": [
    { "name": "sand", "tiles": [ { "mask": 0, "pixels": [ ... ] }, ...one per mask... ] },
    { "name": "grass", "tiles": [ ... ] }
  ],
  "props": [ ... ]
}
```

- `background` (optional) is drawn under every cell first: water, sky.
- Terrains are layers, bottom to top, each drawn over the previous one. A terrain's tiles stop at
  missing neighbours and are transparent beyond, so the layer below shows through. Generated
  maps nest the layers: every grass cell is also a sand cell.
- Extra tiles with a mask already covered are random variants, picked per cell (e.g. flowers).
  An optional `"weight"` (default 1) sets how often each variant is picked, e.g. a plain roof
  at weight 12 next to four rooftop-equipment variants at weight 1.
- `projection` decides tile shape and draw order:
  - `topdown`: square grid.
  - `sideview`: square grid for platformers. N missing = walkable top surface.
  - `isometric` + `footprintHeight`: tiles are `tileWidth` × `footprintHeight` diamonds
    (2:1, so footprintHeight = tileWidth / 2), with `tileHeight - footprintHeight` px of side
    faces below. Grid directions on screen: N ↗, E ↘, S ↙, W ↖. Draw the left side face when
    S is missing, the right one when E is missing.

### Isometric height

One **step** is the side-face depth, `tileHeight - footprintHeight` px. Think of a step as one
storey (12 to 16 px works well at `tileWidth` 64).

- `"elevation"` is the height of the terrain's top surface, in steps (default: the terrain's
  index, which makes terraces).
- `tiles` draw the top surface plus **one step** of side face: the cap (parapet, roof edge,
  cornice).
- `"walls"` (optional) are one-step side-face strips that the renderer repeats **downward from
  the cap to the top of the layer below**. That lets a terrain stand many storeys tall without
  drawing a tall tile for each height. Without `walls`, the cap's own side face is the whole
  wall, as before.

```json
{
  "name": "tower",
  "elevation": 7,
  "tiles": [ ...16 masks: roof + one storey of cap... ],
  "walls": [
    { "face": "left",  "floor": "ground", "pixels": [ ... ] },
    { "face": "left",  "floor": "upper",  "weight": 6, "pixels": [ ... ] },
    { "face": "left",  "floor": "upper",  "weight": 1, "pixels": [ ... ] },
    { "face": "right", "floor": "upper",  "pixels": [ ... ] }
  ]
}
```

- `face`: `left` (drawn where S is missing) or `right` (drawn where E is missing). Each strip is
  `tileWidth / 2` × (step + the face's slope) px, the same shape as that half of a cap's side
  face.
- `floor`: `ground` (the lowest storey: shopfronts, doors, shutters), `upper` (everything in
  between). Several strips for the same face and floor are random variants picked **per storey
  per cell**, weighted by `weight`. That is what breaks up the window grid: give dark, partly
  lit and fully lit floor variants different weights.
- A tower standing on a building runs its walls down to the building's roof, not to the street.

Generators may vary heights per building (see `city` below), so walls must work at any number
of storeys.

### Props

Props are sprites placed on top of the terrain layers: the clutter that makes a scene look
inhabited. They are not autotiled; each is a free-size sprite with an anchor point.

```json
"props": [
  {
    "name": "roof-ac-unit",
    "on": "building",
    "place": "top",
    "chance": 0.35,
    "anchor": [12, 18],
    "variants": [ { "pixels": [ ... ] }, { "weight": 2, "pixels": [ ... ] } ]
  },
  {
    "name": "neon-sign-vertical",
    "on": "tower",
    "place": "left",
    "floors": [1, 4],
    "chance": 0.12,
    "anchor": [3, 20],
    "variants": [ ... ]
  },
  {
    "name": "car",
    "on": "road",
    "place": "top",
    "masks": [5, 10],
    "chance": 0.4,
    "anchor": [14, 10],
    "variants": [ ... ]
  }
]
```

- `on`: the terrain whose cells the prop can stand on. The cell's **top** terrain must be this
  one (no cars under a walkway's deck unless `on` is the road and the walkway allows it).
- `place`:
  - `top`: on the cell's top surface. The anchor lands on the diamond's centre.
  - `left` / `right`: on a side face that is actually drawn (S or E missing). The anchor lands
    on the centre of that face at the chosen storey.
- `floors` (wall props only): `[min, max]` storey range, counted from 0 at the bottom of the
  wall. Default: any.
- `masks` (optional): only on cells with these neighbour masks, e.g. cars only on straight road
  (5 = N+S, 10 = E+W), billboards only on corner cells.
- `chance`: probability per eligible cell (or per eligible storey for wall props). At most one
  instance of each prop per cell; several different props can share a cell.
- `anchor`: `[x, y]` pixel of the sprite that lands on the anchor point.
- Props draw with their cell in depth order, after the cell's tiles and walls, so buildings in
  front hide them correctly.
- Props use the tileset's palette.

Prop sets that make a city read as lived-in, roughly in order of impact: signs and billboards
on street-facing walls, vehicles on roads, pedestrians on walkways and sidewalks, roof
equipment (AC units, vents, tanks, antennas, dishes), street furniture (lamps, bollards, kiosks,
crates, bins), pipes and cables on walls.

### Generators

`generator` (optional) picks the random map:

- `{ "type": "island" }` (default for top-down and isometric): terrains nest like contour
  rings, so every grass cell is also a sand cell.
- `{ "type": "hills" }` (default for side view): rolling ground with floating platforms;
  later terrains are buried deeper (stone under dirt).
- `{ "type": "city", ... }`: a street grid.

```json
"generator": {
  "type": "city",
  "roles": { "road": "road", "rail": "rail", "sidewalk": "sidewalk",
             "building": "building", "tower": "tower", "walkway": "walkway" },
  "blockSize": [3, 6],
  "roadWidth": 2,
  "setback": 0,
  "openSpace": 0,
  "buildingHeight": [2, 4],
  "towerHeight": [3, 9],
  "towerChance": 0.6,
  "railElevation": 3,
  "walkwayElevation": 2
}
```

- Each role names the terrain that draws it; leave a role out to skip it.
- `roadWidth`: road lanes in cells. Wide roads read as a city, one-cell roads as a village.
- `setback`: sidewalk cells between road and building. 0 puts façades straight onto the
  sidewalk role's strip along the road.
- `openSpace`: share of blocks left empty (plazas). Keep it low for a dense city.
- `buildingHeight`, `towerHeight`: storey ranges, picked per lot. The terrain's `elevation` is
  the default when these are left out.
- `railElevation`: the railway runs on a viaduct at this height (0 = at street level).
- `walkwayElevation`: height of the walkways that bridge streets and rails between buildings.
  Walkway cells have no walkway neighbour toward the roofs they land on, so draw walkway end
  tiles running straight through the tile.

### Rendering maps

`npm run map -- <id> --seed N --scale 2 --out <dir>` renders a random map so you can check the
tiles in context. Add `--crop dense` to render only the densest window of the map (or
`--crop x,y,w,h` in pixels) at screen-like framing: judge detail there, not on the full map.

## Art direction: dense isometric city

For tilesets aiming at the reference `reference/cyberpunk-city.jpg`:

- **Scale**: `tileWidth` 64, `footprintHeight` 32, one step ≈ 14–16 px. Roads at least 2 cells
  wide. Detail lives in the extra resolution, not in more tiles.
- **Height everywhere**: buildings 2–4 storeys, towers 3–9 on top of them, the rail on a
  viaduct, walkways at mid height. The frame should look like layers stacked over each other,
  with almost no flat empty ground visible.
- **Palette** (sampled from the reference, extend into ramps):
  - About 90% of the image is a dark, slightly teal-blue grey ramp:
    `#06080c` `#10131c` `#171d27` `#212931` `#27323b` `#303d44` `#3a4a50` `#46595b` `#586c6c`
    `#6f8482`. Street level uses the bottom of the ramp, walkway decks and roofs the top.
  - Muted warm-olive grime and rust: `#454634` `#6b5e42` `#af815c`.
  - Accents, together well under 1% of the pixels: magenta `#a5244b` / `#a130a6`, cyan
    `#3dc2c9` / `#7aced3`, blue `#3598ef`, sodium orange `#bb7946`. Brighten one or two
    pixels in the centre of each sign to make it glow.
  - Lane markings in a dull yellow, not a saturated one.
- **Wear is structural and sparse** (see "Clean surfaces, not noise"): panel seams, a few
  stains running down from windows and ledges, an occasional crack or patch in the asphalt, a
  darker band where walls meet the ground. Seeded randomness may decide *where* these go;
  it must never colour individual pixels. Walkway decks and roofs are flat planes with
  crisp lit edges, like the reference.
- **Façades vary**: per-floor wall variants, a ground floor that differs from the floors above
  (shopfronts, shutters, lit doorways), occasional ledges and setbacks.
- **Props carry the mood**: signs and billboards on the wall faces you see, cars on every road,
  people on walkways, equipment on every roof.

## Workflow for making art

1. **Draw with code, not by hand.** Write a scratch script that generates the pixels:
   - Small sprites: one string per row with a hex character per pixel (`.` for 0). For sheets,
     define body parts once and compose the frames from them.
   - Tilesets: a function from mask to tile (insets, rims and side faces where neighbours are
     missing) rather than drawing 16 tiles by hand.
   - Detailed isometric art: work in grid coordinates (u, v, height) and project to pixels, so
     faces, boxes and patterns line up between tiles. Write helpers for boxes, window grids,
     shading by face direction, edge highlights, seams and placed grime shapes, and build
     tiles, walls and props from them. Never fill a surface with per-pixel noise. Wall trims must depend on the mask, e.g. corner highlights only where the wall
     actually turns a corner, or continuous walls show seams at every tile.
   Convert the result to JSON.
2. Write the JSON file under `library/`.
3. Run `npm run validate`. Errors give exact locations, e.g. `animations[1].frames[2].pixels[3][4]`.
4. **Look at the result.** Run `npm run export -- <id> --scale 12 --out <scratch dir>` (for
   tilesets, `npm run map -- <id> --crop dense --scale 2`), then open the PNG with the Read tool.
5. **Compare against the reference**, if the asset has one (`reference/`). Open both images and
   write down the three biggest differences, judged in this order: overall value structure
   (darkness, where the light falls), surface cleanliness (flat planes, crisp edges, no
   noise), height and layering, density of detail and props, palette, then individual
   shapes. Fix the biggest difference first, then re-render. Don't
   stop because the result "reads well" on its own terms: stop when the differences left are
   ones the user has accepted.
6. Also check silhouette and readability at 1×, whether consecutive frames line up (sheets),
   and whether edges and corners join (tilesets, render a few seeds).

Write one pixel row per line in the JSON. When the palette has more than 10 colors, pad indices
to width 2 (`[ 0,  1, 15]`) so the columns line up.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Viewer at http://localhost:5173 (reloads when assets change) |
| `npm run validate` | Validate every asset in `library/` |
| `npm run export -- [ids...] [--scale N] [--out DIR]` | Write PNGs, plus slicing JSON for sheets and tilesets (default: all assets, 1×, `exports/`) |
| `npm run map -- <tileset-id> [--seed N] [--width W] [--height H] [--scale N] [--crop dense\|x,y,w,h] [--out DIR]` | Render a random map with a tileset |
| `npm test` | Unit tests, plus a check that every library asset is valid |
| `npm run typecheck` | TypeScript check |

## Code layout

- `src/core/`: asset types, validation (`validation/`), rendering to RGBA, sprite sheet layout
  and metadata, animation timing, and `tileset/` (bitmask, noise, map generation, map rendering,
  atlas, walls, props). Has no browser or Node dependencies and is shared by both sides.
- `src/cli/`: Node CLI. Reads `library/` from disk and includes a dependency-free PNG encoder.
- `src/viewer/`: browser viewer (vanilla TypeScript + Vite). Uses `import.meta.glob` to bundle
  every `library/**/*.json` file. `gallery/` has the thumbnails, `detail/` the expanded view, with
  one presenter per asset type (image, sprite sheet, tileset), and `animation/` the shared
  playback clock.
- `reference/`: reference images that assets are compared against. Not bundled by the viewer.

The CLI runs `.ts` directly through Node's built-in type stripping (Node ≥ 22.18). That is why
imports use `.ts` extensions and TypeScript-only runtime syntax (enums, namespaces, constructor
parameter properties) is off-limits (`erasableSyntaxOnly`).
