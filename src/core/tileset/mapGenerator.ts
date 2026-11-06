import { createRandom, type RandomSource, randomInteger } from "../random.ts";
import type { Projection } from "../types.ts";
import { generateNoiseField } from "./noise.ts";

/** One boolean grid per terrain, in tileset order: layers[terrain][y][x]. */
export interface TileMap {
  width: number;
  height: number;
  layers: boolean[][][];
}

export interface MapOptions {
  width: number;
  height: number;
  seed: number;
}

export const MIN_MAP_SIZE = 4;
export const MAX_MAP_SIZE = 128;

/** Island land starts at this height; each further terrain needs this much more. */
const ISLAND_SHORE_LEVEL = 0.44;
const ISLAND_LAYER_STEP = 0.08;
/** How much the island shape follows the noise versus a smooth falloff from the centre. */
const ISLAND_NOISE_WEIGHT = 0.6;

const PLATFORM_LENGTH = { min: 3, max: 6 };
/** Clear rows kept between a platform and the ground below, so the player can walk under it. */
const PLATFORM_CLEARANCE = 3;

function createGrid(options: MapOptions, isFilled: (x: number, y: number) => boolean): boolean[][] {
  return Array.from({ length: options.height }, (_, y) => Array.from({ length: options.width }, (_, x) => isFilled(x, y)));
}

/** 0 at the centre, 1 at the nearest edge, so land gathers in the middle. */
function getEdgeDistance(x: number, y: number, options: MapOptions): number {
  const dx = (2 * (x + 0.5)) / options.width - 1;
  const dy = (2 * (y + 0.5)) / options.height - 1;
  return Math.min(1, Math.hypot(dx, dy));
}

/** Top-down and isometric: an island whose terrains nest like contour lines (sand ⊃ grass ⊃ rock). */
function generateIsland(random: RandomSource, terrainCount: number, options: MapOptions): TileMap {
  const noise = generateNoiseField(random, { ...options, featureSize: 8, octaves: 2 });
  const elevation = (x: number, y: number): number => {
    const falloff = 1 - getEdgeDistance(x, y, options) ** 1.5;
    return ISLAND_NOISE_WEIGHT * (noise[y]?.[x] ?? 0) + (1 - ISLAND_NOISE_WEIGHT) * falloff;
  };
  // Off-map cells count as land when picking tiles, so land on the border would lose its
  // coastline. Keeping the outer ring as water guarantees every island has a full shore.
  const isBorder = (x: number, y: number): boolean => x === 0 || y === 0 || x === options.width - 1 || y === options.height - 1;
  const layers = Array.from({ length: terrainCount }, (_, terrain) =>
    createGrid(options, (x, y) => !isBorder(x, y) && elevation(x, y) >= ISLAND_SHORE_LEVEL + terrain * ISLAND_LAYER_STEP),
  );
  return { width: options.width, height: options.height, layers };
}

function generateSurfaceHeights(random: RandomSource, options: MapOptions): number[] {
  const noise = generateNoiseField(random, { width: options.width, height: 1, featureSize: 10, octaves: 1 })[0] ?? [];
  const lowest = options.height - 2;
  const highest = Math.min(lowest, Math.max(3, Math.floor(options.height * 0.35)));
  return noise.map((value) => Math.round(highest + (1 - value) * (lowest - highest)));
}

function isAreaClear(ground: boolean[][], area: { left: number; right: number; top: number; bottom: number }): boolean {
  for (let y = area.top; y <= area.bottom; y++) {
    for (let x = area.left; x <= area.right; x++) {
      if (ground[y]?.[x]) {
        return false;
      }
    }
  }
  return true;
}

/** Places floating platforms that keep a gap around them, so each reads as its own island. */
function addPlatforms(random: RandomSource, ground: boolean[][], surface: number[], options: MapOptions): void {
  const attempts = Math.floor(options.width / 4);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const length = randomInteger(random, PLATFORM_LENGTH.min, PLATFORM_LENGTH.max);
    const left = randomInteger(random, 0, options.width - length);
    const right = left + length - 1;
    const groundBelow = Math.min(...surface.slice(left, right + 1));
    const y = randomInteger(random, 2, groundBelow - PLATFORM_CLEARANCE - 1);
    if (y < 2 || !isAreaClear(ground, { left: left - 1, right: right + 1, top: y - 2, bottom: y + PLATFORM_CLEARANCE })) {
      continue;
    }
    for (let x = left; x <= right; x++) {
      const row = ground[y];
      if (row) {
        row[x] = true;
      }
    }
  }
}

/**
 * Side view: rolling ground with floating platforms for the first terrain. Each further
 * terrain sits deeper inside the ground, like stone under soil.
 */
function generateSideView(random: RandomSource, terrainCount: number, options: MapOptions): TileMap {
  const surface = generateSurfaceHeights(random, options);
  const ground = createGrid(options, (x, y) => y >= (surface[x] ?? options.height));
  addPlatforms(random, ground, surface, options);

  const depthNoise = generateNoiseField(random, { width: options.width, height: 1, featureSize: 4, octaves: 0 })[0] ?? [];
  const deeperLayers = Array.from({ length: terrainCount - 1 }, (_, index) =>
    createGrid(options, (x, y) => {
      const depth = 2 + 2 * index + Math.round((depthNoise[x] ?? 0) * 2);
      return y >= (surface[x] ?? options.height) + depth;
    }),
  );
  return { width: options.width, height: options.height, layers: [ground, ...deeperLayers] };
}

function assertValidOptions(options: MapOptions): void {
  for (const dimension of [options.width, options.height]) {
    if (!Number.isInteger(dimension) || dimension < MIN_MAP_SIZE || dimension > MAX_MAP_SIZE) {
      throw new Error(`Map width and height must be integers from ${MIN_MAP_SIZE} to ${MAX_MAP_SIZE}, got ${dimension}.`);
    }
  }
}

/** Generates a random map suited to the projection. The same seed always gives the same map. */
export function generateTileMap(projection: Projection, terrainCount: number, options: MapOptions): TileMap {
  assertValidOptions(options);
  const random = createRandom(options.seed);
  return projection.type === "sideview"
    ? generateSideView(random, terrainCount, options)
    : generateIsland(random, terrainCount, options);
}

/** A reasonable default size: platformers are wide, isometric maps get big quickly on screen. */
export function getDefaultMapSize(projection: Projection): { width: number; height: number } {
  const sizes = { topdown: { width: 32, height: 24 }, sideview: { width: 40, height: 20 }, isometric: { width: 18, height: 18 } };
  return sizes[projection.type];
}
