# Pixel Art Library: Instructions for Claude

This project stores pixel art as **palette-indexed JSON data**. Creating an asset means writing a
JSON file under `library/`. The viewer picks it up automatically. No code changes are needed.

## Asset format

One asset per file: `library/<folder>/<asset-name>.json`. The id is the path without `.json`
(for example `cats/cat-8-color`).

```json
{
  "name": "Cat (4 colors)",
  "width": 8,
  "height": 8,
  "palette": [
    { "name": "transparent", "color": "#00000000" },
    { "name": "outline",     "color": "#2a1e1a" },
    { "name": "fur",         "color": "#e8873a" },
    { "name": "pink",        "color": "#f4a4b4" }
  ],
  "pixels": [
    [0, 1, 0, 0, 0, 0, 1, 0],
    ...one array per row, top to bottom...
  ]
}
```

Rules (enforced by `npm run validate`):

- `palette`: 1 to 256 entries. **An entry's position in the array is its color index.** `color` is
  `#rrggbb` or `#rrggbbaa`. Give every entry a `name` that describes its role.
- `pixels[y][x]` is a palette index. Exactly `height` rows, each exactly `width` long.
- `width` and `height` are integers from 1 to 1024.

Conventions:

- Index 0 is `transparent` (`#00000000`) unless the asset needs an opaque background. It counts
  toward the palette size.
- Keep palettes small and purposeful: typically 2, 4, 8 or 16 colors. Order them dark to light
  within each hue ramp.
- Write one pixel row per line. When the palette has more than 10 colors, pad indices to width 2
  (`[ 0,  1, 15]`) so the columns line up and the image is readable as text.

## Workflow for making art

1. Sketch the image as a grid in your head or in a scratch file. Single hex characters per pixel
   (`.` for 0) make shapes easy to see, then convert to the number matrix.
2. Write the JSON file under `library/`.
3. Run `npm run validate`. It reports exact coordinates for bad rows and indices.
4. **Look at the result.** Run `npm run export -- <id> --scale 16 --out <scratch dir>`, then
   open the PNG with the Read tool and critique it: silhouette, symmetry, readability at 1×.
   Iterate until it reads well.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Viewer at http://localhost:5173 (reloads when assets change) |
| `npm run validate` | Validate every asset in `library/` |
| `npm run export -- [ids...] [--scale N] [--out DIR]` | Write PNGs (default: all assets, 1×, `exports/`) |
| `npm test` | Unit tests, plus a check that every library asset is valid |
| `npm run typecheck` | TypeScript check |

## Code layout

- `src/core/`: asset types, validation, rendering to RGBA, and library building. Has no browser or
  Node dependencies and is shared by both sides.
- `src/cli/`: Node CLI. Reads `library/` from disk and includes a dependency-free PNG encoder.
- `src/viewer/`: browser viewer (vanilla TypeScript + Vite). Uses `import.meta.glob` to bundle
  every `library/**/*.json` file.

The CLI runs `.ts` directly through Node's built-in type stripping (Node ≥ 22.18). That is why
imports use `.ts` extensions and TypeScript-only runtime syntax (enums, namespaces) is off-limits
(`erasableSyntaxOnly`).
