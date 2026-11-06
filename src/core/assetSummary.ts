import { countFrames, renderSpriteSheet } from "./spriteSheet.ts";
import { renderImage, type RgbaImage } from "./render.ts";
import type { Asset, PixelMatrix } from "./types.ts";

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** One-line description, e.g. "16×16 · 8 colors" or "16×16 frames · 3 animations · 12 frames · 8 colors". */
export function describeAsset(asset: Asset): string {
  const colors = pluralize(asset.palette.length, "color");
  if (asset.type === "image") {
    return `${asset.width}×${asset.height} · ${colors}`;
  }
  const animations = pluralize(asset.animations.length, "animation");
  const frames = pluralize(countFrames(asset), "frame");
  return `${asset.frameWidth}×${asset.frameHeight} frames · ${animations} · ${frames} · ${colors}`;
}

/** Every pixel matrix the asset contains: one for an image, one per frame for a sheet. */
export function getAllPixelMatrices(asset: Asset): PixelMatrix[] {
  if (asset.type === "image") {
    return [asset.pixels];
  }
  return asset.animations.flatMap((animation) => animation.frames.map((frame) => frame.pixels));
}

/** The image a PNG export contains: the picture itself, or the whole sheet. */
export function renderAssetForExport(asset: Asset, scale = 1): RgbaImage {
  return asset.type === "image" ? renderImage(asset, scale) : renderSpriteSheet(asset, scale);
}
