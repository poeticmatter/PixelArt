# Pixel Art Library

Pixel art for video games, stored as plain data: a small named palette, plus matrices of palette
indices. Assets live as JSON files in `library/` and are still **images**, **sprite sheets** (a
character's named animations, such as idle, walk and jump) or **tilesets** (autotiling terrain,
chosen per cell by a neighbour bitmask, for top-down, isometric or side-view platformer maps). A browser viewer shows them
all as thumbnails, with sprite sheets animating in place. Any asset can be opened, zoomed and
exported as a lossless PNG.

**Live viewer:** https://poeticmatter.github.io/PixelArt/ (deployed from `main` by GitHub Actions).

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
- **Sprite sheets** in the detail view: pick an animation, play/pause, step frame by frame,
  click a frame in the strip, or show the whole sheet as it will export. Export the sheet PNG at
  1× or at zoom, plus a frame-data JSON (frame rectangles, durations, loop flags) for your engine.
- **Tilesets** in the detail view: a randomly generated map built from the tileset (change the
  seed or size, or press "New map"), or the tiles themselves with one row per terrain and one column
  per mask. Export the map as PNG, or the tileset as an atlas PNG plus a JSON of tile rectangles
  and masks.
- Keys in the detail view: `+`/`-` zoom, `0` fit, `g` grid, `←`/`→` previous/next asset,
  `Esc` close. For sprite sheets: `Space` play/pause, `,`/`.` step frames, `↑`/`↓`
  switch animation, `s` toggle the whole sheet. For tilesets: `r` new map, `t` toggle tiles.

## Command line

```bash
npm run validate
```

```bash
npm run export -- cats/cat-16-color --scale 8
```

Exports go to `exports/` by default. With no ids, every asset is exported. A sprite sheet writes
`<name>.png` (one row per animation, one column per frame) and `<name>.json` with each
frame's rectangle and duration at the exported scale. A tileset writes its atlas and a JSON
with each tile's rectangle and neighbour mask.

```bash
npm run map -- tilesets/meadow-island --seed 7 --scale 2
```

Renders a random map with a tileset. The same seed always gives the same map.

## Examples

`library/cats/` has the same cat drawn at four palette sizes: 2 and 4 colors on 8×8, and 8 and
16 colors on 16×16. `cats/grey-tabby-sprites` is the grey tabby as a side-view game character
with idle, walk and jump animations.

`library/tilesets/` has one tileset per projection:
- `meadow-island`: top-down, with water background, sand, grass and forest.
- `grassy-hills`: side-view platformer, with sky background, grass-topped dirt and stone.
- `terraced-island`: isometric, with water background and sand, grass and rock terraces.
- `neon-sprawl`: isometric cyberpunk city. It has roads with lane markings and zebra crossings, a railway
  with level crossings, buildings with lit windows, neon-rimmed towers, and elevated walkways on
  pillars. It uses the `city` map generator and per-terrain elevation.
- `neon-sprawl-hd`: the same city at much higher fidelity, with 64×64 tiles and a 63-colour palette. Details include:
  - beveled paving slabs, curbs with visible faces, and roads with manholes and neon-reflecting puddles
  - ballast, wooden sleepers and highlighted rails
  - office windows over lit or shuttered storefronts, and blade signs
  - rooftop AC units, skylights, billboards and vents
  - glass curtain-wall towers with neon corners and helipads
  - skybridges with glass railings and lit undersides
