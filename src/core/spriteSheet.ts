import { copyImageInto, createBlankImage, renderImage, type RgbaImage } from "./render.ts";
import type { Animation, AnimationFrame, PixelImage, SpriteSheetAsset } from "./types.ts";

export interface SheetGrid {
  /** The longest animation's frame count; shorter rows leave trailing cells transparent. */
  columns: number;
  /** One row per animation, in file order. */
  rows: number;
}

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
  durationMs: number;
}

/** Engine-friendly description of where each frame sits in the exported sheet image. */
export interface SheetMetadata {
  image: string;
  frameWidth: number;
  frameHeight: number;
  animations: { name: string; loop: boolean; frames: FrameRect[] }[];
}

export function getSheetGrid(sheet: SpriteSheetAsset): SheetGrid {
  return {
    columns: Math.max(...sheet.animations.map((animation) => animation.frames.length)),
    rows: sheet.animations.length,
  };
}

export function getFrameDurations(animation: Animation): number[] {
  return animation.frames.map((frame) => frame.durationMs ?? animation.frameDurationMs);
}

export function countFrames(sheet: SpriteSheetAsset): number {
  return sheet.animations.reduce((total, animation) => total + animation.frames.length, 0);
}

/** Views one frame as a standalone image so it can use the regular image renderer. */
export function getFrameImage(sheet: SpriteSheetAsset, frame: AnimationFrame): PixelImage {
  return { width: sheet.frameWidth, height: sheet.frameHeight, palette: sheet.palette, pixels: frame.pixels };
}

export function renderSpriteSheet(sheet: SpriteSheetAsset, scale = 1): RgbaImage {
  const grid = getSheetGrid(sheet);
  const cellWidth = sheet.frameWidth * scale;
  const cellHeight = sheet.frameHeight * scale;
  const output = createBlankImage(grid.columns * cellWidth, grid.rows * cellHeight);

  sheet.animations.forEach((animation, row) => {
    animation.frames.forEach((frame, column) => {
      const frameImage = renderImage(getFrameImage(sheet, frame), scale);
      copyImageInto(output, frameImage, { x: column * cellWidth, y: row * cellHeight });
    });
  });
  return output;
}

/** Frame rectangles in the coordinates of the sheet image exported at `scale`. */
export function createSheetMetadata(sheet: SpriteSheetAsset, imageFileName: string, scale = 1): SheetMetadata {
  const width = sheet.frameWidth * scale;
  const height = sheet.frameHeight * scale;
  return {
    image: imageFileName,
    frameWidth: width,
    frameHeight: height,
    animations: sheet.animations.map((animation, row) => ({
      name: animation.name,
      loop: animation.loop,
      frames: getFrameDurations(animation).map((durationMs, column) => ({
        x: column * width,
        y: row * height,
        width,
        height,
        durationMs,
      })),
    })),
  };
}
