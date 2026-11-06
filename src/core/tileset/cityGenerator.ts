import { type RandomSource, randomInteger } from "../random.ts";
import type { CityGeneratorConfig, CityRole, IntegerRange } from "../types.ts";
import { createEmptyGrid, createGrid, fillCell, type Grid, isCellFilled, type MapOptions } from "./tileMap.ts";

const DEFAULT_BLOCK_SIZE: IntegerRange = [3, 6];
const DEFAULT_ROAD_WIDTH = 1;
const DEFAULT_SETBACK = 0;
const DEFAULT_OPEN_SPACE = 0.15;
const DEFAULT_TOWER_CHANCE = 0.6;
const ALLEY_CHANCE = 0.5;
const DEFAULT_WALKWAY_CHANCE = 0.25;
/** Cells kept between walkways over the same street, so they don't merge. */
const WALKWAY_SPACING = 3;
/** Smallest building side that leaves a roof ring around a tower. */
const MIN_SIDE_FOR_RING = 3;
/** Shortest building side worth splitting with an alley. */
const MIN_SIDE_FOR_ALLEY = 5;

/** Heights in storeys that the generator needs from the tileset when the config leaves them out. */
export interface CityTerrainHeights {
  building: number;
  tower: number;
  rail: number;
  walkway: number;
}

/** Every option resolved to a concrete value. */
interface CitySettings {
  blockSize: IntegerRange;
  roadWidth: number;
  /** Sidewalk cells between road and building: the kerb strip plus the setback. */
  margin: number;
  openSpace: number;
  buildingHeight: IntegerRange | undefined;
  towerHeight: IntegerRange | undefined;
  towerChance: number;
  railElevation: number;
  walkwayElevation: number;
  walkwayChance: number;
}

export interface CityLayout {
  grids: Record<CityRole, Grid>;
  /** Per-cell heights for roles whose height varies or was set by the config. */
  elevations: Partial<Record<CityRole, number[][]>>;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A full-length band of road lanes across the map. */
interface Band {
  axis: "vertical" | "horizontal";
  start: number;
  width: number;
}

function resolveSettings(config: CityGeneratorConfig, heights: CityTerrainHeights): CitySettings {
  return {
    blockSize: config.blockSize ?? DEFAULT_BLOCK_SIZE,
    roadWidth: config.roadWidth ?? DEFAULT_ROAD_WIDTH,
    margin: 1 + (config.setback ?? DEFAULT_SETBACK),
    openSpace: config.openSpace ?? DEFAULT_OPEN_SPACE,
    buildingHeight: config.buildingHeight,
    towerHeight: config.towerHeight,
    towerChance: config.towerChance ?? DEFAULT_TOWER_CHANCE,
    railElevation: config.railElevation ?? heights.rail,
    walkwayElevation: config.walkwayElevation ?? heights.walkway,
    walkwayChance: config.walkwayChance ?? DEFAULT_WALKWAY_CHANCE,
  };
}

/**
 * Road positions along one axis: lot, sidewalk, road, sidewalk, lot… The map edge gets a
 * sidewalk margin too, because off-map cells count as filled and would hide edge walls.
 */
function pickRoadStarts(random: RandomSource, length: number, settings: CitySettings): number[] {
  const { margin, roadWidth, blockSize } = settings;
  const starts: number[] = [];
  let cursor = margin + randomInteger(random, blockSize[0], blockSize[1]) + margin;
  while (cursor + roadWidth + margin + blockSize[0] + margin <= length) {
    starts.push(cursor);
    cursor += roadWidth + margin + randomInteger(random, blockSize[0], blockSize[1]) + margin;
  }
  return starts;
}

function forEachBandCell(band: Band, length: number, visit: (x: number, y: number, across: number) => void): void {
  for (let across = 0; across < band.width; across++) {
    for (let along = 0; along < length; along++) {
      if (band.axis === "vertical") {
        visit(band.start + across, along, across);
      } else {
        visit(along, band.start + across, across);
      }
    }
  }
}

function getBandLength(band: Band, options: MapOptions): number {
  return band.axis === "vertical" ? options.height : options.width;
}

/** Lots between the bands, already set back by the sidewalk margin on every side. */
function listLots(bands: Band[], options: MapOptions, margin: number): Rect[] {
  const intervals = (axis: Band["axis"], length: number): { start: number; end: number }[] => {
    const cuts = bands.filter((band) => band.axis === axis).sort((first, second) => first.start - second.start);
    const edges = [{ start: -1, end: -1 }, ...cuts.map((band) => ({ start: band.start, end: band.start + band.width - 1 })), { start: length, end: length }];
    return edges.slice(1).map((edge, index) => ({ start: (edges[index]?.end ?? -1) + 1 + margin, end: edge.start - 1 - margin }));
  };
  const columns = intervals("vertical", options.width);
  const rows = intervals("horizontal", options.height);
  return rows.flatMap((row) => columns.map((column) => ({ left: column.start, right: column.end, top: row.start, bottom: row.end })));
}

function getSize(rect: Rect): { width: number; height: number } {
  return { width: rect.right - rect.left + 1, height: rect.bottom - rect.top + 1 };
}

/** Splits a long building in two with a one-cell alley across its longer side. */
function splitWithAlley(random: RandomSource, rect: Rect): Rect[] {
  const { width, height } = getSize(rect);
  if (Math.max(width, height) < MIN_SIDE_FOR_ALLEY || random() >= ALLEY_CHANCE) {
    return [rect];
  }
  if (width >= height) {
    const alley = rect.left + randomInteger(random, 2, width - 3);
    return [{ ...rect, right: alley - 1 }, { ...rect, left: alley + 1 }];
  }
  const alley = rect.top + randomInteger(random, 2, height - 3);
  return [{ ...rect, bottom: alley - 1 }, { ...rect, top: alley + 1 }];
}

function fillRect(grid: Grid, rect: Rect, heights?: { grid: number[][]; value: number }): void {
  for (let y = rect.top; y <= rect.bottom; y++) {
    for (let x = rect.left; x <= rect.right; x++) {
      fillCell(grid, x, y);
      const row = heights?.grid[y];
      if (row && heights) {
        row[x] = heights.value;
      }
    }
  }
}

interface BuildContext {
  random: RandomSource;
  settings: CitySettings;
  heights: CityTerrainHeights;
  layout: CityLayout;
  buildingHeights: number[][];
  towerHeights: number[][];
  bands: Band[];
  railBand: Band | undefined;
}

function addBuilding(rect: Rect, context: BuildContext): void {
  const { random, settings, heights, layout } = context;
  const range = settings.buildingHeight;
  const buildingHeight = range ? randomInteger(random, range[0], range[1]) : heights.building;
  fillRect(layout.grids.building, rect, { grid: context.buildingHeights, value: buildingHeight });
  if (random() >= settings.towerChance) {
    return;
  }
  // A tower stands on its building, so it always rises above the roof it sits on. Wide
  // buildings keep a roof ring around it; narrow ones become one tall slender block.
  const towerRange = settings.towerHeight;
  const towerTop = towerRange ? buildingHeight + randomInteger(random, towerRange[0], towerRange[1]) : Math.max(heights.tower, buildingHeight + 1);
  const size = getSize(rect);
  const hasRoomForRing = Math.min(size.width, size.height) >= MIN_SIDE_FOR_RING;
  const towerRect = hasRoomForRing ? { left: rect.left + 1, top: rect.top + 1, right: rect.right - 1, bottom: rect.bottom - 1 } : rect;
  fillRect(layout.grids.tower, towerRect, { grid: context.towerHeights, value: towerTop });
}

function addBuildings(lots: Rect[], context: BuildContext): void {
  for (const lot of lots) {
    const { width, height } = getSize(lot);
    if (width < 1 || height < 1 || context.random() < context.settings.openSpace) {
      continue;
    }
    splitWithAlley(context.random, lot).forEach((building) => addBuilding(building, context));
  }
}

/** The cells a walkway across `band` at `offset` would cover, plus the building cell at each end. */
function getBridge(band: Band, offset: number, margin: number): { span: [number, number][]; anchors: [[number, number], [number, number]] } {
  const at = (across: number): [number, number] => (band.axis === "vertical" ? [band.start + across, offset] : [offset, band.start + across]);
  const first = -margin, last = band.width - 1 + margin;
  const span = Array.from({ length: last - first + 1 }, (_, index) => at(first + index));
  return { span, anchors: [at(first - 1), at(last + 1)] };
}

/** Bridges streets between buildings that face each other and are tall enough to meet the walkway. */
function addWalkways(options: MapOptions, context: BuildContext): void {
  const { random, settings, layout, buildingHeights } = context;
  // A walkway lands on a roof, or runs into the side of a tower standing on that roof.
  const reachesWalkway = ([x, y]: [number, number]): boolean =>
    isCellFilled(layout.grids.building, x, y) && (buildingHeights[y]?.[x] ?? 0) >= settings.walkwayElevation;
  // A walkway can't cross a viaduct at the viaduct's own height.
  const isBlockedByViaduct = (band: Band): boolean =>
    band === context.railBand && settings.railElevation > 0 && settings.railElevation === settings.walkwayElevation;
  for (const band of context.bands.filter((candidate) => !isBlockedByViaduct(candidate))) {
    let lastBridge = -WALKWAY_SPACING;
    for (let offset = 0; offset < getBandLength(band, options); offset++) {
      const { span, anchors } = getBridge(band, offset, settings.margin);
      if (!anchors.every(reachesWalkway) || offset - lastBridge < WALKWAY_SPACING || random() >= settings.walkwayChance) {
        continue;
      }
      span.forEach(([x, y]) => fillCell(layout.grids.walkway, x, y));
      lastBridge = offset;
    }
  }
}

/**
 * Lays the railway along one band: on a viaduct over its middle lane, or (at street level)
 * replacing the band's road so the rail crosses the other streets at level crossings.
 */
function addRailway(band: Band, options: MapOptions, context: BuildContext): void {
  const { layout, settings } = context;
  const railLane = Math.floor(band.width / 2);
  const isViaduct = settings.railElevation > 0;
  forEachBandCell(band, getBandLength(band, options), (x, y, across) => {
    if (across === railLane) {
      fillCell(layout.grids.rail, x, y);
    }
  });
  if (!isViaduct) {
    forEachBandCell(band, getBandLength(band, options), (x, y) => {
      const row = layout.grids.road[y];
      if (row) {
        row[x] = false;
      }
    });
    // Streets crossing the railway keep their road surface under the level crossing.
    context.bands
      .filter((other) => other.axis !== band.axis)
      .forEach((other) => forEachBandCell(other, getBandLength(other, options), (x, y) => fillCell(layout.grids.road, x, y)));
  }
}

function createElevationGrid(options: MapOptions, value: number): number[][] {
  return Array.from({ length: options.height }, () => Array<number>(options.width).fill(value));
}

/**
 * A street grid of `roadWidth`-lane roads with sidewalks, buildings on the lots, towers on
 * some roofs, a railway (street level or viaduct), and walkways bridging streets between buildings.
 */
export function generateCityLayout(random: RandomSource, config: CityGeneratorConfig, heights: CityTerrainHeights, options: MapOptions): CityLayout {
  const settings = resolveSettings(config, heights);
  const layout: CityLayout = {
    grids: {
      road: createEmptyGrid(options),
      rail: createEmptyGrid(options),
      sidewalk: createEmptyGrid(options),
      building: createEmptyGrid(options),
      tower: createEmptyGrid(options),
      walkway: createEmptyGrid(options),
    },
    elevations: {},
  };
  const bands: Band[] = [
    ...pickRoadStarts(random, options.width, settings).map((start) => ({ axis: "vertical" as const, start, width: settings.roadWidth })),
    ...pickRoadStarts(random, options.height, settings).map((start) => ({ axis: "horizontal" as const, start, width: settings.roadWidth })),
  ];
  bands.forEach((band) => forEachBandCell(band, getBandLength(band, options), (x, y) => fillCell(layout.grids.road, x, y)));
  const railBand = bands.length > 0 ? bands[randomInteger(random, 0, bands.length - 1)] : undefined;
  const context: BuildContext = {
    random,
    settings,
    heights,
    layout,
    buildingHeights: createElevationGrid(options, heights.building),
    towerHeights: createElevationGrid(options, heights.tower),
    bands,
    railBand,
  };
  if (railBand) {
    addRailway(railBand, options, context);
  }
  // Sidewalk is everything that isn't road: kerbs then only form along the roads.
  layout.grids.sidewalk = createGrid(options, (x, y) => !isCellFilled(layout.grids.road, x, y));
  addBuildings(listLots(bands, options, settings.margin), context);
  addWalkways(options, context);

  if (settings.buildingHeight) layout.elevations.building = context.buildingHeights;
  if (settings.buildingHeight || settings.towerHeight) layout.elevations.tower = context.towerHeights;
  if (config.railElevation !== undefined) layout.elevations.rail = createElevationGrid(options, settings.railElevation);
  if (config.walkwayElevation !== undefined) layout.elevations.walkway = createElevationGrid(options, settings.walkwayElevation);
  return layout;
}
