import type { Animation, ImageAsset, PaletteColor, SpriteSheetAsset, TilesetAsset } from "./types.ts";

const MASK_COUNT = 16;

/**
 * A 1×1-tile tileset whose tile for mask m is palette color m + 1 (red channel = m + 1),
 * so a rendered map pixel reveals which mask was chosen. Index 0 is transparent.
 */
export function createTestTileset(overrides: Partial<TilesetAsset> = {}): TilesetAsset {
  const palette: PaletteColor[] = [
    { name: "transparent", color: "#00000000" },
    ...Array.from({ length: MASK_COUNT }, (_, mask) => ({
      name: `mask ${mask}`,
      color: `#${(mask + 1).toString(16).padStart(2, "0")}0000`,
    })),
  ];
  return {
    type: "tileset",
    name: "Test tileset",
    projection: { type: "topdown" },
    tileWidth: 1,
    tileHeight: 1,
    palette,
    terrains: [{ name: "land", tiles: Array.from({ length: MASK_COUNT }, (_, mask) => ({ mask, pixels: [[mask + 1]] })) }],
    ...overrides,
  };
}

/** Colours of the isometric test tileset, by index. Each is distinct in the red channel. */
export const ISO_COLORS = { transparent: 0, cap: 1, ground: 2, upper: 3, prop: 4 } as const;

const ISO_TILE = { width: 4, footprint: 2, height: 4 };
const ISO_STRIP = { width: ISO_TILE.width / 2, height: ISO_TILE.height - ISO_TILE.footprint + ISO_TILE.footprint / 2 };

function fillMatrix(width: number, height: number, color: number): number[][] {
  return Array.from({ length: height }, () => Array<number>(width).fill(color));
}

/**
 * A tiny isometric tileset (4×4 tiles, footprint 2, so one step is 2px) with two terrains:
 * "street" at elevation 0 and "block" at 3 with ground/upper walls in distinct colours, plus
 * a 1×1 roof prop. Rendered pixels reveal which part was drawn.
 */
export function createTestIsometricTileset(overrides: Partial<TilesetAsset> = {}): TilesetAsset {
  const palette: PaletteColor[] = ["#00000000", "#010000", "#020000", "#030000", "#040000"].map((color, index) => ({
    name: `colour ${index}`,
    color,
  }));
  const tiles = (color: number): TilesetAsset["terrains"][number]["tiles"] =>
    Array.from({ length: MASK_COUNT }, (_, mask) => ({ mask, pixels: fillMatrix(ISO_TILE.width, ISO_TILE.height, color) }));
  return {
    type: "tileset",
    name: "Test isometric tileset",
    projection: { type: "isometric", footprintHeight: ISO_TILE.footprint },
    tileWidth: ISO_TILE.width,
    tileHeight: ISO_TILE.height,
    palette,
    terrains: [
      { name: "street", elevation: 0, tiles: tiles(ISO_COLORS.transparent) },
      {
        name: "block",
        elevation: 3,
        tiles: tiles(ISO_COLORS.transparent),
        walls: [
          { face: "left", floor: "ground", pixels: fillMatrix(ISO_STRIP.width, ISO_STRIP.height, ISO_COLORS.ground) },
          { face: "left", floor: "upper", pixels: fillMatrix(ISO_STRIP.width, ISO_STRIP.height, ISO_COLORS.upper) },
          { face: "right", floor: "upper", pixels: fillMatrix(ISO_STRIP.width, ISO_STRIP.height, ISO_COLORS.upper) },
        ],
      },
    ],
    props: [{ name: "antenna", on: "block", place: "top", chance: 1, anchor: [0, 0], variants: [{ pixels: [[ISO_COLORS.prop]] }] }],
    ...overrides,
  };
}

export const ISO_STRIP_SIZE = ISO_STRIP;

const TEST_PALETTE: PaletteColor[] = [
  { name: "transparent", color: "#00000000" },
  { name: "red", color: "#ff0000" },
  { name: "green", color: "#00ff00" },
  { name: "blue", color: "#0000ff80" },
];

/** A 2×2 image: transparent, red / green, half-transparent blue. Shared by tests. */
export function createTestImage(overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    type: "image",
    name: "Test",
    width: 2,
    height: 2,
    palette: TEST_PALETTE,
    pixels: [
      [0, 1],
      [2, 3],
    ],
    ...overrides,
  };
}

/** A 1×1-frame sheet: "idle" has 2 frames (red, green), "jump" has 1 frame (blue) held for 300 ms. */
export function createTestSpriteSheet(overrides: Partial<SpriteSheetAsset> = {}): SpriteSheetAsset {
  const animations: Animation[] = [
    { name: "idle", frameDurationMs: 100, loop: true, frames: [{ pixels: [[1]] }, { pixels: [[2]] }] },
    { name: "jump", frameDurationMs: 100, loop: false, frames: [{ pixels: [[3]], durationMs: 300 }] },
  ];
  return {
    type: "spritesheet",
    name: "Test sheet",
    frameWidth: 1,
    frameHeight: 1,
    palette: TEST_PALETTE,
    animations,
    ...overrides,
  };
}
