import { renderImage } from "../../core/render.ts";
import { getFrameImage } from "../../core/spriteSheet.ts";
import { generateTileMap } from "../../core/tileset/mapGenerator.ts";
import { renderTileMap } from "../../core/tileset/renderTileMap.ts";
import type { Asset, ImageAsset, SpriteSheetAsset, TilesetAsset } from "../../core/types.ts";
import type { AnimationClock } from "../animation/animationClock.ts";
import { createPreviewPlayback } from "../animation/animationPreview.ts";
import { drawRgbaImage, getFittingScale } from "../canvas.ts";
import { createElement } from "../dom.ts";

const THUMBNAIL_SIZE = { width: 128, height: 128 };

function createImageThumbnail(asset: ImageAsset): HTMLCanvasElement {
  const canvas = createElement("canvas", { className: "pixel-canvas" });
  drawRgbaImage(canvas, renderImage(asset, getFittingScale(asset, THUMBNAIL_SIZE)));
  return canvas;
}

/** Plays the sheet's first animation, which by convention is the character's idle. */
function createSpriteSheetThumbnail(sheet: SpriteSheetAsset, clock: AnimationClock): HTMLCanvasElement {
  const canvas = createElement("canvas", { className: "pixel-canvas" });
  const [animation] = sheet.animations;
  if (!animation) {
    return canvas;
  }
  const scale = getFittingScale({ width: sheet.frameWidth, height: sheet.frameHeight }, THUMBNAIL_SIZE);
  const frameImages = animation.frames.map((frame) => renderImage(getFrameImage(sheet, frame), scale));
  const playback = createPreviewPlayback(animation);
  const drawCurrentFrame = (): void => {
    const frameImage = frameImages[playback.frameIndex];
    if (frameImage) {
      drawRgbaImage(canvas, frameImage);
    }
  };

  drawCurrentFrame();
  // The gallery lives as long as the page, so this subscription never needs releasing.
  clock.subscribe((deltaMs) => {
    if (playback.advance(deltaMs)) {
      drawCurrentFrame();
    }
  });
  return canvas;
}

/** Thumbnail maps are small but still show each projection's character; CSS scales them to fit. */
const THUMBNAIL_MAP_SIZES = {
  topdown: { width: 12, height: 12 },
  sideview: { width: 16, height: 9 },
  isometric: { width: 12, height: 12 },
} as const;
/** A fixed seed keeps the gallery stable between reloads. */
const THUMBNAIL_MAP_SEED = 7;

function createTilesetThumbnail(tileset: TilesetAsset): HTMLCanvasElement {
  const canvas = createElement("canvas", { className: "pixel-canvas pixel-canvas--fit" });
  const size = THUMBNAIL_MAP_SIZES[tileset.projection.type];
  const map = generateTileMap(tileset, { ...size, seed: THUMBNAIL_MAP_SEED });
  drawRgbaImage(canvas, renderTileMap(tileset, map));
  return canvas;
}

export function createThumbnail(asset: Asset, clock: AnimationClock): HTMLCanvasElement {
  switch (asset.type) {
    case "image":
      return createImageThumbnail(asset);
    case "spritesheet":
      return createSpriteSheetThumbnail(asset, clock);
    case "tileset":
      return createTilesetThumbnail(asset);
  }
}
