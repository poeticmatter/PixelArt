import { parseHexColor } from "./color.ts";
import type { PixelAsset, Rgba } from "./types.ts";

const BYTES_PER_PIXEL = 4;

export interface RgbaImage {
  width: number;
  height: number;
  /** Row-major RGBA bytes, 4 per pixel, no padding. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

export function assertValidScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error(`Scale must be a positive integer, got ${scale}.`);
  }
}

function resolvePalette(asset: PixelAsset): Rgba[] {
  return asset.palette.map((entry) => parseHexColor(entry.color));
}

function writePixelBlock(image: RgbaImage, origin: { x: number; y: number }, scale: number, color: Rgba): void {
  for (let blockY = 0; blockY < scale; blockY++) {
    const rowStart = ((origin.y + blockY) * image.width + origin.x) * BYTES_PER_PIXEL;
    for (let blockX = 0; blockX < scale; blockX++) {
      const offset = rowStart + blockX * BYTES_PER_PIXEL;
      image.data[offset] = color.red;
      image.data[offset + 1] = color.green;
      image.data[offset + 2] = color.blue;
      image.data[offset + 3] = color.alpha;
    }
  }
}

/**
 * Expands palette indices into RGBA pixels, scaling each source pixel to a
 * scale×scale block (nearest neighbour, so edges stay crisp). Expects a validated asset.
 */
export function renderAsset(asset: PixelAsset, scale = 1): RgbaImage {
  assertValidScale(scale);
  const colors = resolvePalette(asset);
  const width = asset.width * scale;
  const height = asset.height * scale;
  const image: RgbaImage = { width, height, data: new Uint8ClampedArray(width * height * BYTES_PER_PIXEL) };

  asset.pixels.forEach((row, y) => {
    row.forEach((colorIndex, x) => {
      const color = colors[colorIndex];
      if (!color) {
        throw new Error(`Pixel (${x}, ${y}) uses color index ${colorIndex}, which is not in the palette.`);
      }
      writePixelBlock(image, { x: x * scale, y: y * scale }, scale, color);
    });
  });
  return image;
}
