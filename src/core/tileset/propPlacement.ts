import { hashPosition } from "../random.ts";
import type { Prop, TilesetAsset } from "../types.ts";
import { NEIGHBOR_BITS } from "./bitmask.ts";
import { type Cell, getCellElevation, getLayerMask, getTopLayer, getWallBase } from "./mapQueries.ts";
import type { TileMap } from "./tileMap.ts";
import { pickWeighted } from "./weightedPick.ts";

/** Salts keep each prop's dice independent of other props and of tile variant picks. */
const SALT_PLACE = 7_000;
const SALT_VARIANT = 9_000;
const SALTS_PER_PROP = 97;

/** Where one prop instance goes: a point on the cell in grid units, and which sprite variant. */
export interface PropInstance {
  propIndex: number;
  variantIndex: number;
  /** Grid position on the cell: (0.5, 0.5) is the centre of the top, (0.5, 1) the left face. */
  u: number;
  v: number;
  /** Height of the anchor point, in steps. */
  height: number;
}

function rollFor(cell: Cell, propIndex: number, salt: number): number {
  return hashPosition(cell.x, cell.y, salt + propIndex * SALTS_PER_PROP);
}

function pickVariantIndex(prop: Prop, cell: Cell, propIndex: number): number {
  const variant = pickWeighted(prop.variants, rollFor(cell, propIndex, SALT_VARIANT));
  return variant ? prop.variants.indexOf(variant) : 0;
}

/** The storey a wall prop lands on, rolling `chance` per eligible storey; undefined if none. */
function pickStorey(prop: Prop, storeyCount: number, cell: Cell, propIndex: number): number | undefined {
  const [lowest, highest] = prop.floors ?? [0, storeyCount - 1];
  for (let storey = Math.max(0, lowest); storey <= Math.min(highest, storeyCount - 1); storey++) {
    if (hashPosition(cell.x, cell.y, SALT_PLACE + propIndex * SALTS_PER_PROP + storey + 1) < prop.chance) {
      return storey;
    }
  }
  return undefined;
}

function placeProp(tileset: TilesetAsset, map: TileMap, cell: Cell, propIndex: number, layer: number): PropInstance | undefined {
  const prop = tileset.props?.[propIndex];
  if (!prop) {
    return undefined;
  }
  const mask = getLayerMask(map, layer, cell);
  if (prop.masks && !prop.masks.includes(mask)) {
    return undefined;
  }
  const top = getCellElevation(tileset, map, layer, cell);
  const variantIndex = pickVariantIndex(prop, cell, propIndex);
  if (prop.place === "top") {
    return rollFor(cell, propIndex, SALT_PLACE) < prop.chance ? { propIndex, variantIndex, u: 0.5, v: 0.5, height: top } : undefined;
  }
  // A wall prop needs that face to be drawn: the left face shows where S is missing, the right where E is.
  const isFaceDrawn = (mask & (prop.place === "left" ? NEIGHBOR_BITS.south : NEIGHBOR_BITS.east)) === 0;
  const base = getWallBase(tileset, map, layer, cell);
  const storey = isFaceDrawn ? pickStorey(prop, top - base, cell, propIndex) : undefined;
  if (storey === undefined) {
    return undefined;
  }
  const facePoint = prop.place === "left" ? { u: 0.5, v: 1 } : { u: 1, v: 0.5 };
  return { propIndex, variantIndex, ...facePoint, height: base + storey + 0.5 };
}

/**
 * The props on one cell. Only props whose `on` terrain is the cell's top layer qualify, at
 * most one instance of each. Deterministic: the same map always gets the same props.
 */
export function placePropsInCell(tileset: TilesetAsset, map: TileMap, cell: Cell): PropInstance[] {
  const topLayer = getTopLayer(tileset, map, cell);
  if (topLayer === undefined || !tileset.props) {
    return [];
  }
  const topTerrainName = tileset.terrains[topLayer]?.name;
  return tileset.props.flatMap((prop, propIndex) => {
    if (prop.on !== topTerrainName) {
      return [];
    }
    const instance = placeProp(tileset, map, cell, propIndex, topLayer);
    return instance ? [instance] : [];
  });
}
