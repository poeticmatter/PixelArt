import { hashPosition } from "../random.ts";
import { renderImage, type RgbaImage } from "../render.ts";
import type { PixelMatrix, TilesetAsset } from "../types.ts";
import { MASK_COUNT } from "./bitmask.ts";

/** Every tile pre-rendered at one scale, grouped so a map cell's tile is a lookup. */
export interface RenderedTileset {
  background: RgbaImage | undefined;
  /** variantsByMask[terrain][mask] lists that mask's variants. */
  variantsByMask: RgbaImage[][][];
}

export function renderTileImage(tileset: TilesetAsset, pixels: PixelMatrix, scale: number): RgbaImage {
  return renderImage({ width: tileset.tileWidth, height: tileset.tileHeight, palette: tileset.palette, pixels }, scale);
}

export function renderTilesetImages(tileset: TilesetAsset, scale: number): RenderedTileset {
  return {
    background: tileset.background && renderTileImage(tileset, tileset.background.pixels, scale),
    variantsByMask: tileset.terrains.map((terrain) => {
      const byMask: RgbaImage[][] = Array.from({ length: MASK_COUNT }, () => []);
      for (const tile of terrain.tiles) {
        byMask[tile.mask]?.push(renderTileImage(tileset, tile.pixels, scale));
      }
      return byMask;
    }),
  };
}

/** Picks a variant by position, so the same map always renders the same way. */
export function selectTileImage(
  rendered: RenderedTileset,
  cell: { terrain: number; mask: number; x: number; y: number },
): RgbaImage | undefined {
  const variants = rendered.variantsByMask[cell.terrain]?.[cell.mask] ?? [];
  return variants[Math.floor(hashPosition(cell.x, cell.y, cell.terrain) * variants.length)];
}
