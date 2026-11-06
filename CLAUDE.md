# Pixel Art Library: Instructions for Claude

This project stores pixel art for video games as **palette-indexed JSON data**. Creating an asset
means writing a JSON file under `library/`. The viewer picks it up automatically. No code changes
are needed.

One asset per file: `library/<folder>/<asset-name>.json`. The id is the path without `.json`
(for example `cats/cat-8-color`). Every asset has a `"type"`: `"image"` for a still,
`"spritesheet"` for a character's animations, or `"tileset"` for autotiling map terrain.

## Palette (shared by both types)

- 1 to 256 entries. **An entry's position in the array is its color index.**
- `color` is `#rrggbb` or `#rrggbbaa`. Give every entry a `name` that describes its role.
- Index 0 is `transparent` (`#00000000`) unless the asset needs an opaque background. It counts
  toward the palette size.
- Keep palettes small and purposeful: typically 2, 4, 8 or 16 colors. Order them dark to light
  within each hue ramp.

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
  ]
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
- Isometric terrains can set `"elevation"` in steps of that side-face depth (default: the
  terrain's index, which makes terraces). Make the side faces exactly one step tall: a raised
  tile's walls then reach down to street level, e.g. a building at elevation 1, a tower on it at 2.
- `generator` (optional) picks the random map:
  - `{ "type": "island" }` (default for top-down and isometric): terrains nest like contour
    rings, so every grass cell is also a sand cell.
  - `{ "type": "hills" }` (default for side view): rolling ground with floating platforms;
    later terrains are buried deeper (stone under dirt).
  - `{ "type": "city", "roles": { "road": "...", "rail": "...", "building": "...", "tower": "...",
    "walkway": "..." } }`: a street grid where one line is a railway, buildings set back by
    sidewalks, towers on some roofs, and walkways bridging streets and rails between
    buildings. Each role names the terrain that draws it; leave a role out to skip it.
    Walkway cells have no walkway neighbour toward the roofs they land on, so draw walkway
    end tiles running straight through the tile.
- `npm run map -- <id> --seed N --scale 2 --out <dir>` renders a random map so you can check
  the tiles in context.

## Workflow for making art

1. Sketch in a scratch script: one string per row with a hex character per pixel (`.` for 0).
   For sheets, define body parts once and compose the frames from them. For tilesets, write a
   function from mask to tile (insets, rims and side faces where neighbours are missing) rather
   than drawing 16 tiles by hand. Convert to JSON. For detailed isometric art, work in grid
   coordinates (u, v, height) and project to pixels, so faces, boxes and patterns line up
   between tiles. Wall trims must depend on the mask, e.g. corner highlights only where the
   wall actually turns a corner, or continuous walls show seams at every tile.
2. Write the JSON file under `library/`.
3. Run `npm run validate`. Errors give exact locations, e.g. `animations[1].frames[2].pixels[3][4]`.
4. **Look at the result.** Run `npm run export -- <id> --scale 12 --out <scratch dir>`, then
   open the PNG with the Read tool and critique it: silhouette, readability at 1× and, for sheets,
   whether consecutive frames line up. For tilesets, render a few maps with `npm run map` and
   check that edges and corners join. Iterate until it reads well.

Write one pixel row per line in the JSON. When the palette has more than 10 colors, pad indices
to width 2 (`[ 0,  1, 15]`) so the columns line up.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Viewer at http://localhost:5173 (reloads when assets change) |
| `npm run validate` | Validate every asset in `library/` |
| `npm run export -- [ids...] [--scale N] [--out DIR]` | Write PNGs, plus slicing JSON for sheets and tilesets (default: all assets, 1×, `exports/`) |
| `npm run map -- <tileset-id> [--seed N] [--width W] [--height H] [--scale N] [--out DIR]` | Render a random map with a tileset |
| `npm test` | Unit tests, plus a check that every library asset is valid |
| `npm run typecheck` | TypeScript check |

## Code layout

- `src/core/`: asset types, validation (`validation/`), rendering to RGBA, sprite sheet layout
  and metadata, animation timing, and `tileset/` (bitmask, noise, map generation, map rendering,
  atlas). Has no browser or Node dependencies and is shared by both sides.
- `src/cli/`: Node CLI. Reads `library/` from disk and includes a dependency-free PNG encoder.
- `src/viewer/`: browser viewer (vanilla TypeScript + Vite). Uses `import.meta.glob` to bundle
  every `library/**/*.json` file. `gallery/` has the thumbnails, `detail/` the expanded view, with
  one presenter per asset type (image, sprite sheet, tileset), and `animation/` the shared
  playback clock.

The CLI runs `.ts` directly through Node's built-in type stripping (Node ≥ 22.18). That is why
imports use `.ts` extensions and TypeScript-only runtime syntax (enums, namespaces, constructor
parameter properties) is off-limits (`erasableSyntaxOnly`).
