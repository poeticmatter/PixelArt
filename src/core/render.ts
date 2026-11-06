import { parseHexColor } from "./color.ts";
import type { PixelImage, Rgba } from "./types.ts";

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

/** A fully transparent image, used as the canvas that frames are copied onto. */
export function createBlankImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * BYTES_PER_PIXEL) };
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
 * scale×scale block (nearest neighbour, so edges stay crisp). Expects validated data.
 */
export function renderImage(image: PixelImage, scale = 1): RgbaImage {
  assertValidScale(scale);
  const colors = image.palette.map((entry) => parseHexColor(entry.color));
  const output = createBlankImage(image.width * scale, image.height * scale);

  image.pixels.forEach((row, y) => {
    row.forEach((colorIndex, x) => {
      const color = colors[colorIndex];
      if (!color) {
        throw new Error(`Pixel (${x}, ${y}) uses color index ${colorIndex}, which is not in the palette.`);
      }
      writePixelBlock(output, { x: x * scale, y: y * scale }, scale, color);
    });
  });
  return output;
}

const MAX_CHANNEL = 255;

function blendPixelOver(target: RgbaImage, targetOffset: number, source: RgbaImage, sourceOffset: number): void {
  const sourceAlpha = (source.data[sourceOffset + 3] ?? 0) / MAX_CHANNEL;
  if (sourceAlpha === 0) {
    return;
  }
  const targetAlpha = (target.data[targetOffset + 3] ?? 0) / MAX_CHANNEL;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  for (let channel = 0; channel < 3; channel++) {
    const sourceValue = source.data[sourceOffset + channel] ?? 0;
    const targetValue = target.data[targetOffset + channel] ?? 0;
    target.data[targetOffset + channel] =
      (sourceValue * sourceAlpha + targetValue * targetAlpha * (1 - sourceAlpha)) / outputAlpha;
  }
  target.data[targetOffset + 3] = outputAlpha * MAX_CHANNEL;
}

/**
 * Draws `source` over `target` with alpha blending ("source over"), clipping to the
 * target's bounds. Used to layer transparent-edged tiles.
 */
export function drawImageOver(target: RgbaImage, source: RgbaImage, origin: { x: number; y: number }): void {
  const startX = Math.max(0, -origin.x);
  const startY = Math.max(0, -origin.y);
  const endX = Math.min(source.width, target.width - origin.x);
  const endY = Math.min(source.height, target.height - origin.y);
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const sourceOffset = (y * source.width + x) * BYTES_PER_PIXEL;
      const targetOffset = ((origin.y + y) * target.width + origin.x + x) * BYTES_PER_PIXEL;
      blendPixelOver(target, targetOffset, source, sourceOffset);
    }
  }
}

/** Copies `source` into `target` with its top-left corner at (x, y). Both must fit. */
export function copyImageInto(target: RgbaImage, source: RgbaImage, origin: { x: number; y: number }): void {
  const rowLength = source.width * BYTES_PER_PIXEL;
  for (let y = 0; y < source.height; y++) {
    const sourceStart = y * rowLength;
    const targetStart = ((origin.y + y) * target.width + origin.x) * BYTES_PER_PIXEL;
    target.data.set(source.data.subarray(sourceStart, sourceStart + rowLength), targetStart);
  }
}
