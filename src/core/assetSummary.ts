import { renderImage, type RgbaImage } from "./render.ts";
import { countFrames, createSheetMetadata, renderSpriteSheet } from "./spriteSheet.ts";
import { createTilesetMetadata, renderTilesetAtlas } from "./tileset/tilesetAtlas.ts";
import type { Asset, PixelMatrix } from "./types.ts";

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** One-line description, e.g. "16×16 · 8 colors" or "16×16 frames · 3 animations · 12 frames · 8 colors". */
export function describeAsset(asset: Asset): string {
  const colors = pluralize(asset.palette.length, "color");
  switch (asset.type) {
    case "image":
      return `${asset.width}×${asset.height} · ${colors}`;
    case "spritesheet":
      return [
        `${asset.frameWidth}×${asset.frameHeight} frames`,
        pluralize(asset.animations.length, "animation"),
        pluralize(countFrames(asset), "frame"),
        colors,
      ].join(" · ");
    case "tileset":
      return [
        `${asset.projection.type} ${asset.tileWidth}×${asset.tileHeight} tiles`,
        pluralize(asset.terrains.length, "terrain"),
        colors,
      ].join(" · ");
  }
}

/** Every pixel matrix the asset contains: one for an image, one per frame or tile otherwise. */
export function getAllPixelMatrices(asset: Asset): PixelMatrix[] {
  switch (asset.type) {
    case "image":
      return [asset.pixels];
    case "spritesheet":
      return asset.animations.flatMap((animation) => animation.frames.map((frame) => frame.pixels));
    case "tileset": {
      const tiles = asset.terrains.flatMap((terrain) => terrain.tiles.map((tile) => tile.pixels));
      return asset.background ? [asset.background.pixels, ...tiles] : tiles;
    }
  }
}

/**
 * The JSON that accompanies an exported PNG so a game engine can slice it: frame
 * rectangles for sprite sheets, tile rectangles and masks for tilesets. Images need none.
 */
export function createExportMetadata(asset: Asset, imageFileName: string, scale = 1): object | undefined {
  switch (asset.type) {
    case "image":
      return undefined;
    case "spritesheet":
      return createSheetMetadata(asset, imageFileName, scale);
    case "tileset":
      return createTilesetMetadata(asset, imageFileName, scale);
  }
}

/** The image a PNG export contains: the picture itself, the whole sheet, or the tile atlas. */
export function renderAssetForExport(asset: Asset, scale = 1): RgbaImage {
  switch (asset.type) {
    case "image":
      return renderImage(asset, scale);
    case "spritesheet":
      return renderSpriteSheet(asset, scale);
    case "tileset":
      return renderTilesetAtlas(asset, scale);
  }
}
