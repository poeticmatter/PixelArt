import type { Animation, ImageAsset, PaletteColor, SpriteSheetAsset } from "./types.ts";

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
