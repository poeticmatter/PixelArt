import { hashPosition } from "../random.ts";
import { renderImage, type RgbaImage } from "../render.ts";
import type { PixelMatrix, TilesetAsset, WallFace, WallFloor, WallStrip } from "../types.ts";
import { MASK_COUNT } from "./bitmask.ts";
import { DEFAULT_WEIGHT, pickWeighted } from "./weightedPick.ts";

export interface WeightedImage {
  image: RgbaImage;
  weight: number;
}

/** A terrain's wall strips by face and floor; either floor may be empty (the other stands in). */
export type RenderedWalls = Record<WallFace, Record<WallFloor, WeightedImage[]>>;

/** Every tile, wall strip and prop sprite pre-rendered at one scale, so painting is lookups. */
export interface RenderedTileset {
  background: RgbaImage | undefined;
  /** variantsByMask[terrain][mask] lists that mask's variants with their weights. */
  variantsByMask: WeightedImage[][][];
  /** walls[terrain], for terrains that have walls. */
  walls: (RenderedWalls | undefined)[];
  /** props[prop] lists that prop's sprite variants. */
  props: WeightedImage[][];
}

function renderMatrix(tileset: TilesetAsset, pixels: PixelMatrix, scale: number): RgbaImage {
  const width = pixels[0]?.length ?? 0;
  return renderImage({ width, height: pixels.length, palette: tileset.palette, pixels }, scale);
}

export function renderTileImage(tileset: TilesetAsset, pixels: PixelMatrix, scale: number): RgbaImage {
  return renderImage({ width: tileset.tileWidth, height: tileset.tileHeight, palette: tileset.palette, pixels }, scale);
}

function renderWalls(tileset: TilesetAsset, walls: WallStrip[] | undefined, scale: number): RenderedWalls | undefined {
  if (!walls) {
    return undefined;
  }
  const rendered: RenderedWalls = { left: { ground: [], upper: [] }, right: { ground: [], upper: [] } };
  for (const strip of walls) {
    rendered[strip.face][strip.floor].push({ image: renderMatrix(tileset, strip.pixels, scale), weight: strip.weight ?? DEFAULT_WEIGHT });
  }
  return rendered;
}

export function renderTilesetImages(tileset: TilesetAsset, scale: number): RenderedTileset {
  return {
    background: tileset.background && renderTileImage(tileset, tileset.background.pixels, scale),
    variantsByMask: tileset.terrains.map((terrain) => {
      const byMask: WeightedImage[][] = Array.from({ length: MASK_COUNT }, () => []);
      for (const tile of terrain.tiles) {
        byMask[tile.mask]?.push({ image: renderTileImage(tileset, tile.pixels, scale), weight: tile.weight ?? DEFAULT_WEIGHT });
      }
      return byMask;
    }),
    walls: tileset.terrains.map((terrain) => renderWalls(tileset, terrain.walls, scale)),
    props: (tileset.props ?? []).map((prop) =>
      prop.variants.map((variant) => ({ image: renderMatrix(tileset, variant.pixels, scale), weight: variant.weight ?? DEFAULT_WEIGHT })),
    ),
  };
}

/** Picks a tile variant by position and weight, so the same map always renders the same way. */
export function selectTileImage(
  rendered: RenderedTileset,
  cell: { terrain: number; mask: number; x: number; y: number },
): RgbaImage | undefined {
  const variants = rendered.variantsByMask[cell.terrain]?.[cell.mask] ?? [];
  return pickWeighted(variants, hashPosition(cell.x, cell.y, cell.terrain))?.image;
}

/** Salt base for wall picks, well clear of the terrain indices used for tile picks. */
const WALL_SALT = 1_000;

/**
 * Picks one storey's wall strip, independently per storey and cell, so façades vary floor by
 * floor. Falls back to the other floor type when a terrain only defines one.
 */
export function selectWallImage(
  walls: RenderedWalls,
  storey: { face: WallFace; floor: WallFloor; level: number; terrain: number; x: number; y: number },
): RgbaImage | undefined {
  const byFloor = walls[storey.face];
  const otherFloor: WallFloor = storey.floor === "ground" ? "upper" : "ground";
  const candidates = byFloor[storey.floor].length > 0 ? byFloor[storey.floor] : byFloor[otherFloor];
  const salt = WALL_SALT + storey.terrain * 256 + storey.level * 2 + (storey.face === "left" ? 0 : 1);
  return pickWeighted(candidates, hashPosition(storey.x, storey.y, salt))?.image;
}
