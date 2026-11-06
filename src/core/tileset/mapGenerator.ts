import { createRandom } from "../random.ts";
import {
  CITY_ROLES,
  type CityGeneratorConfig,
  type CityRole,
  type MapGeneratorConfig,
  type Projection,
  type TilesetAsset,
} from "../types.ts";
import { type CityTerrainHeights, generateCityLayout } from "./cityGenerator.ts";
import { getTerrainElevation } from "./mapQueries.ts";
import { generateHills, generateIsland } from "./naturalGenerators.ts";
import { createEmptyGrid, MAX_MAP_SIZE, type MapOptions, MIN_MAP_SIZE, type TileMap } from "./tileMap.ts";

type GeneratorInput = Pick<TilesetAsset, "projection" | "generator" | "terrains">;

function assertValidOptions(options: MapOptions): void {
  for (const dimension of [options.width, options.height]) {
    if (!Number.isInteger(dimension) || dimension < MIN_MAP_SIZE || dimension > MAX_MAP_SIZE) {
      throw new Error(`Map width and height must be integers from ${MIN_MAP_SIZE} to ${MAX_MAP_SIZE}, got ${dimension}.`);
    }
  }
}

/** The tileset's own generator, or the natural default for its projection. */
export function getMapGenerator(tileset: Pick<TilesetAsset, "projection" | "generator">): MapGeneratorConfig {
  return tileset.generator ?? (tileset.projection.type === "sideview" ? { type: "hills" } : { type: "island" });
}

function findRoleTerrain(tileset: Pick<TilesetAsset, "terrains">, config: CityGeneratorConfig, role: CityRole): number {
  return tileset.terrains.findIndex((terrain) => terrain.name === config.roles[role]);
}

/** Heights the city falls back on when its config leaves them out: the role terrains' elevations. */
function getRoleHeights(tileset: Pick<TilesetAsset, "terrains">, config: CityGeneratorConfig): CityTerrainHeights {
  const heightOf = (role: CityRole, fallback: number): number => {
    const index = findRoleTerrain(tileset, config, role);
    return index === -1 ? fallback : getTerrainElevation(tileset, index);
  };
  return { building: heightOf("building", 1), tower: heightOf("tower", 2), rail: heightOf("rail", 0), walkway: heightOf("walkway", 1) };
}

/** Lays each generated city feature, and its heights, onto the layer of the terrain its role names. */
function generateCity(tileset: Pick<TilesetAsset, "terrains">, config: CityGeneratorConfig, options: MapOptions): TileMap {
  const layout = generateCityLayout(createRandom(options.seed), config, getRoleHeights(tileset, config), options);
  const roleOf = (terrainName: string): CityRole | undefined => CITY_ROLES.find((role) => config.roles[role] === terrainName);
  const layers = tileset.terrains.map((terrain) => {
    const role = roleOf(terrain.name);
    return role ? layout.grids[role] : createEmptyGrid(options);
  });
  const elevations = tileset.terrains.map((terrain) => {
    const role = roleOf(terrain.name);
    return role ? layout.elevations[role] : undefined;
  });
  return { width: options.width, height: options.height, layers, elevations };
}

/** Generates a random map for the tileset. The same seed always gives the same map. */
export function generateTileMap(tileset: GeneratorInput, options: MapOptions): TileMap {
  assertValidOptions(options);
  const generator = getMapGenerator(tileset);
  const terrainCount = tileset.terrains.length;
  switch (generator.type) {
    case "island":
      return generateIsland(createRandom(options.seed), terrainCount, options);
    case "hills":
      return generateHills(createRandom(options.seed), terrainCount, options);
    case "city":
      return generateCity(tileset, generator, options);
  }
}

/** A reasonable default size: platformers are wide, isometric maps get big quickly on screen. */
export function getDefaultMapSize(projection: Projection): { width: number; height: number } {
  const sizes = { topdown: { width: 32, height: 24 }, sideview: { width: 40, height: 20 }, isometric: { width: 20, height: 20 } };
  return sizes[projection.type];
}
