import { renderAsset } from "../core/render.ts";
import type { PixelAsset } from "../core/types.ts";

/** Grid lines only help once a pixel is big enough to see the gaps between them. */
export const MIN_SCALE_FOR_GRID = 4;
const GRID_LINE_COLOR = "rgba(127, 127, 127, 0.45)";

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot create a 2D canvas context.");
  }
  return context;
}

/** Draws the asset at an exact integer scale, so the canvas is pixel-identical to an export. */
export function drawAsset(canvas: HTMLCanvasElement, asset: PixelAsset, scale: number): void {
  const image = renderAsset(asset, scale);
  canvas.width = image.width;
  canvas.height = image.height;
  getContext(canvas).putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
}

export function drawPixelGrid(canvas: HTMLCanvasElement, asset: PixelAsset, scale: number): void {
  const context = getContext(canvas);
  context.fillStyle = GRID_LINE_COLOR;
  for (let x = 1; x < asset.width; x++) {
    context.fillRect(x * scale, 0, 1, canvas.height);
  }
  for (let y = 1; y < asset.height; y++) {
    context.fillRect(0, y * scale, canvas.width, 1);
  }
}

/** The largest integer scale at which the asset fits inside a square of the given size. */
export function getFittingScale(asset: PixelAsset, availableSize: number): number {
  return Math.max(1, Math.floor(availableSize / Math.max(asset.width, asset.height)));
}
