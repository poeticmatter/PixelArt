import { renderImage } from "../../core/render.ts";
import { getFrameImage } from "../../core/spriteSheet.ts";
import type { Asset, ImageAsset, SpriteSheetAsset } from "../../core/types.ts";
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

export function createThumbnail(asset: Asset, clock: AnimationClock): HTMLCanvasElement {
  return asset.type === "image" ? createImageThumbnail(asset) : createSpriteSheetThumbnail(asset, clock);
}
