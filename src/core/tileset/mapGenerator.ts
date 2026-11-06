import { createRandom } from "../random.ts";
import { CITY_ROLES, type CityRole, type MapGeneratorConfig, type Projection, type TilesetAsset } from "../types.ts";
import { generateCityGrids } from "./cityGenerator.ts";
import { generateHills, generateIsland } from "./naturalGenerators.ts";
import { createEmptyGrid, MAX_MAP_SIZE, type MapOptions, MIN_MAP_SIZE, type TileMap } from "./tileMap.ts";

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

/** Lays each generated city feature onto the layer of the terrain its role names. */
function generateCity(tileset: Pick<TilesetAsset, "terrains">, roles: Partial<Record<CityRole, string>>, options: MapOptions): TileMap {
  const grids = generateCityGrids(createRandom(options.seed), options);
  const layers = tileset.terrains.map((terrain) => {
    const role = CITY_ROLES.find((cityRole) => roles[cityRole] === terrain.name);
    return role ? grids[role] : createEmptyGrid(options);
  });
  return { width: options.width, height: options.height, layers };
}

/** Generates a random map for the tileset. The same seed always gives the same map. */
export function generateTileMap(
  tileset: Pick<TilesetAsset, "projection" | "generator" | "terrains">,
  options: MapOptions,
): TileMap {
  assertValidOptions(options);
  const generator = getMapGenerator(tileset);
  const terrainCount = tileset.terrains.length;
  switch (generator.type) {
    case "island":
      return generateIsland(createRandom(options.seed), terrainCount, options);
    case "hills":
      return generateHills(createRandom(options.seed), terrainCount, options);
    case "city":
      return generateCity(tileset, generator.roles, options);
  }
}

/** A reasonable default size: platformers are wide, isometric maps get big quickly on screen. */
export function getDefaultMapSize(projection: Projection): { width: number; height: number } {
  const sizes = { topdown: { width: 32, height: 24 }, sideview: { width: 40, height: 20 }, isometric: { width: 20, height: 20 } };
  return sizes[projection.type];
}
