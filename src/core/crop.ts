import { copyImageInto, createBlankImage, type RgbaImage } from "./render.ts";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A 16:9 window about the size of a game screen at 1× for 64px tiles. */
export const DENSE_WINDOW = { width: 640, height: 360 };
/** Candidate windows are tried every this many (scaled) pixels. */
const SEARCH_STRIDE = 8;
const BYTES_PER_PIXEL = 4;

/** Copies a rectangle out of an image; the rectangle must lie inside it. */
export function cropImage(image: RgbaImage, rect: CropRect): RgbaImage {
  if (rect.x < 0 || rect.y < 0 || rect.width < 1 || rect.height < 1 || rect.x + rect.width > image.width || rect.y + rect.height > image.height) {
    throw new Error(`Crop ${rect.x},${rect.y},${rect.width},${rect.height} does not fit inside the ${image.width}×${image.height} image.`);
  }
  const output = createBlankImage(rect.width, rect.height);
  for (let row = 0; row < rect.height; row++) {
    const start = ((rect.y + row) * image.width + rect.x) * BYTES_PER_PIXEL;
    const rowImage = { width: rect.width, height: 1, data: image.data.slice(start, start + rect.width * BYTES_PER_PIXEL) };
    copyImageInto(output, rowImage, { x: 0, y: row });
  }
  return output;
}

function getLuminance(image: RgbaImage, offset: number): number {
  const alpha = (image.data[offset + 3] ?? 0) / 255;
  return alpha * (0.299 * (image.data[offset] ?? 0) + 0.587 * (image.data[offset + 1] ?? 0) + 0.114 * (image.data[offset + 2] ?? 0));
}

/**
 * Summed-area table of local contrast (difference to the right and lower neighbours):
 * detailed, busy areas score high, flat or empty areas low.
 */
function buildDetailTable(image: RgbaImage): Float64Array {
  const { width, height } = image;
  const table = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * BYTES_PER_PIXEL;
      const here = getLuminance(image, offset);
      const right = x + 1 < width ? getLuminance(image, offset + BYTES_PER_PIXEL) : here;
      const below = y + 1 < height ? getLuminance(image, offset + width * BYTES_PER_PIXEL) : here;
      rowSum += Math.abs(here - right) + Math.abs(here - below);
      table[(y + 1) * (width + 1) + x + 1] = (table[y * (width + 1) + x + 1] ?? 0) + rowSum;
    }
  }
  return table;
}

/** The window of the given size with the most detail: where to judge a busy map up close. */
export function findDensestWindow(image: RgbaImage, size: { width: number; height: number }, stride = SEARCH_STRIDE): CropRect {
  const width = Math.min(size.width, image.width);
  const height = Math.min(size.height, image.height);
  const table = buildDetailTable(image);
  const sumAt = (x: number, y: number): number => table[y * (image.width + 1) + x] ?? 0;
  let best: CropRect = { x: 0, y: 0, width, height };
  let bestScore = -1;
  for (let y = 0; y + height <= image.height; y += stride) {
    for (let x = 0; x + width <= image.width; x += stride) {
      const score = sumAt(x + width, y + height) - sumAt(x, y + height) - sumAt(x + width, y) + sumAt(x, y);
      if (score > bestScore) {
        bestScore = score;
        best = { x, y, width, height };
      }
    }
  }
  return best;
}
