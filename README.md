# Pixel Art Library

Pixel art stored as plain data: a small named palette, plus a matrix of palette indices. Assets
live as JSON files in `library/`. A browser viewer shows them all as thumbnails. Any asset can
be opened, zoomed and exported as a lossless PNG.

Designed so Claude Code can generate art directly. See [CLAUDE.md](CLAUDE.md) for the asset
format and authoring workflow.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. Adding or editing a file in `library/` reloads the page.

## Viewer

- **Gallery**: every asset, grouped by folder. Invalid files appear under "Needs fixing" with
  their errors.
- **Detail view** (click a thumbnail): integer zoom from 1× to 64×, checkerboard/dark/light
  backgrounds, an optional pixel grid, the palette with indices and per-color pixel counts, and
  PNG export at 1× or at the current zoom.
- Keys in the detail view: `+`/`-` zoom, `0` fit, `g` grid, `←`/`→` previous/next, `Esc` close.

## Command line

```bash
npm run validate
```

```bash
npm run export -- cats/cat-16-color --scale 8
```

Exports go to `exports/` by default. With no ids, every asset is exported.

## Examples

`library/cats/` has the same cat drawn at four palette sizes: 2 and 4 colors on 8×8, and 8 and
16 colors on 16×16.
