import type { PixelAsset } from "./types.ts";

/** A 2×2 asset: transparent, red / green, half-transparent blue. Shared by tests. */
export function createTestAsset(overrides: Partial<PixelAsset> = {}): PixelAsset {
  return {
    name: "Test",
    width: 2,
    height: 2,
    palette: [
      { name: "transparent", color: "#00000000" },
      { name: "red", color: "#ff0000" },
      { name: "green", color: "#00ff00" },
      { name: "blue", color: "#0000ff80" },
    ],
    pixels: [
      [0, 1],
      [2, 3],
    ],
    ...overrides,
  };
}
