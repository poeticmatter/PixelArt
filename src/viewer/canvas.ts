import type { RgbaImage } from "../core/render.ts";

/** Grid lines only help once a pixel is big enough to see the gaps between them. */
export const MIN_SCALE_FOR_GRID = 4;
const GRID_LINE_COLOR = "rgba(127, 127, 127, 0.45)";

export interface Size {
  width: number;
  height: number;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot create a 2D canvas context.");
  }
  return context;
}

/** Resizes the canvas to the image and draws it 1:1, so on-screen pixels match an export exactly. */
export function drawRgbaImage(canvas: HTMLCanvasElement, image: RgbaImage): void {
  canvas.width = image.width;
  canvas.height = image.height;
  getContext(canvas).putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
}

/** Draws a line between every source pixel; `scale` is the on-canvas size of one source pixel. */
export function drawPixelGrid(canvas: HTMLCanvasElement, scale: number): void {
  const context = getContext(canvas);
  context.fillStyle = GRID_LINE_COLOR;
  for (let x = scale; x < canvas.width; x += scale) {
    context.fillRect(x, 0, 1, canvas.height);
  }
  for (let y = scale; y < canvas.height; y += scale) {
    context.fillRect(0, y, canvas.width, 1);
  }
}

/** The largest integer scale at which content of `size` fits inside `available`. */
export function getFittingScale(size: Size, available: Size): number {
  return Math.max(1, Math.floor(Math.min(available.width / size.width, available.height / size.height)));
}
