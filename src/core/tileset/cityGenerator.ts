import { type RandomSource, randomInteger } from "../random.ts";
import type { CityRole } from "../types.ts";
import { createEmptyGrid, fillCell, type Grid, isCellFilled, type MapOptions } from "./tileMap.ts";

/** Gap between parallel streets, in cells, so blocks are big enough for buildings. */
const STREET_SPACING = { min: 6, max: 9 };
/** Streets stay this far from the map edge, leaving edge lots wide enough to build on. */
const MIN_EDGE_DISTANCE = 4;
const PLAZA_CHANCE = 0.15;
const ALLEY_CHANCE = 0.5;
const TOWER_CHANCE = 0.6;
const WALKWAY_CHANCE = 0.25;
/** A walkway needs a building on each side of the street it crosses: sidewalk, street, sidewalk. */
const WALKWAY_REACH = 2;
/** Rows (or columns) kept between walkways over the same street, so they don't merge. */
const WALKWAY_SPACING = 3;
/** Smallest building side that leaves a roof ring around a tower. */
const MIN_SIDE_FOR_TOWER = 3;
/** Shortest building side worth splitting with an alley. */
const MIN_SIDE_FOR_ALLEY = 5;

type CityGrids = Record<CityRole, Grid>;

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A full-length line across the map: a street or a rail line. */
interface Line {
  axis: "vertical" | "horizontal";
  position: number;
}

function pickStreetPositions(random: RandomSource, length: number): number[] {
  const positions: number[] = [];
  const lastAllowed = length - 1 - MIN_EDGE_DISTANCE;
  let position = randomInteger(random, MIN_EDGE_DISTANCE, MIN_EDGE_DISTANCE + 2);
  while (position <= lastAllowed) {
    positions.push(position);
    position += randomInteger(random, STREET_SPACING.min, STREET_SPACING.max);
  }
  return positions;
}

/**
 * Turns one street line into the rail line, so the rail keeps full-size blocks on both
 * sides and crosses the streets that run the other way at level crossings.
 */
function pickRailLine(random: RandomSource, lines: Line[]): Line | undefined {
  if (lines.length === 0) {
    return undefined;
  }
  return lines[randomInteger(random, 0, lines.length - 1)];
}

function drawLine(grid: Grid, line: Line, options: MapOptions): void {
  const length = line.axis === "vertical" ? options.height : options.width;
  for (let step = 0; step < length; step++) {
    if (line.axis === "vertical") {
      fillCell(grid, line.position, step);
    } else {
      fillCell(grid, step, line.position);
    }
  }
}

function fillRect(grid: Grid, rect: Rect): void {
  for (let y = rect.top; y <= rect.bottom; y++) {
    for (let x = rect.left; x <= rect.right; x++) {
      fillCell(grid, x, y);
    }
  }
}

/**
 * The stretches between lines, narrowed by a one-cell sidewalk on both sides. The map edge
 * counts as a line too: off-map cells count as filled when tiles are picked, so a building
 * touching the edge would lose its walls there.
 */
function getLotIntervals(cuts: number[], length: number): { start: number; end: number }[] {
  const sortedCuts = [-1, ...[...cuts].sort((first, second) => first - second), length];
  return sortedCuts.slice(1).map((cut, index) => ({ start: (sortedCuts[index] ?? -1) + 2, end: cut - 2 }));
}

/** Building lots between the street and rail lines, set back by a sidewalk. */
function listLots(lines: Line[], options: MapOptions): Rect[] {
  const columns = getLotIntervals(lines.filter((line) => line.axis === "vertical").map((line) => line.position), options.width);
  const rows = getLotIntervals(lines.filter((line) => line.axis === "horizontal").map((line) => line.position), options.height);
  return rows.flatMap((row) => columns.map((column) => ({ left: column.start, right: column.end, top: row.start, bottom: row.end })));
}

function shrink(rect: Rect, amount: number): Rect {
  return { left: rect.left + amount, top: rect.top + amount, right: rect.right - amount, bottom: rect.bottom - amount };
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

/** Fills each lot with buildings; some get a tower on the roof. */
function addBuildings(random: RandomSource, grids: CityGrids, lots: Rect[]): void {
  for (const footprint of lots) {
    const { width, height } = getSize(footprint);
    if (width < 2 || height < 2 || random() < PLAZA_CHANCE) {
      continue;
    }
    for (const building of splitWithAlley(random, footprint)) {
      fillRect(grids.building, building);
      const size = getSize(building);
      if (Math.min(size.width, size.height) >= MIN_SIDE_FOR_TOWER && random() < TOWER_CHANCE) {
        fillRect(grids.tower, shrink(building, 1));
      }
    }
  }
}

/** Cells a walkway at `offset` along the line would cover, plus the two building cells it joins. */
function getBridgeCells(line: Line, offset: number): { span: [number, number][]; anchors: [number, number][] } {
  const at = (across: number): [number, number] =>
    line.axis === "vertical" ? [line.position + across, offset] : [offset, line.position + across];
  const span = Array.from({ length: 2 * WALKWAY_REACH - 1 }, (_, index) => at(index - WALKWAY_REACH + 1));
  return { span, anchors: [at(-WALKWAY_REACH), at(WALKWAY_REACH)] };
}

/** Bridges streets and rails between buildings that face each other across them. */
function addWalkways(random: RandomSource, grids: CityGrids, lines: Line[], options: MapOptions): void {
  for (const line of lines) {
    const length = line.axis === "vertical" ? options.height : options.width;
    let lastBridge = -WALKWAY_SPACING;
    for (let offset = 0; offset < length; offset++) {
      const { span, anchors } = getBridgeCells(line, offset);
      const joinsBuildings = anchors.every(([x, y]) => isCellFilled(grids.building, x, y) && !isCellFilled(grids.tower, x, y));
      if (!joinsBuildings || offset - lastBridge < WALKWAY_SPACING || random() >= WALKWAY_CHANCE) {
        continue;
      }
      span.forEach(([x, y]) => fillCell(grids.walkway, x, y));
      lastBridge = offset;
    }
  }
}

/**
 * A street grid where one line is a railway, buildings on the blocks, towers on some
 * roofs, and walkways bridging streets and rails between buildings.
 */
export function generateCityGrids(random: RandomSource, options: MapOptions): CityGrids {
  const grids: CityGrids = {
    road: createEmptyGrid(options),
    rail: createEmptyGrid(options),
    building: createEmptyGrid(options),
    tower: createEmptyGrid(options),
    walkway: createEmptyGrid(options),
  };
  const streets = { vertical: pickStreetPositions(random, options.width), horizontal: pickStreetPositions(random, options.height) };
  const allLines: Line[] = [
    ...streets.vertical.map((position) => ({ axis: "vertical" as const, position })),
    ...streets.horizontal.map((position) => ({ axis: "horizontal" as const, position })),
  ];
  const railLine = pickRailLine(random, allLines);
  for (const line of allLines) {
    drawLine(line === railLine ? grids.rail : grids.road, line, options);
  }
  // Streets crossing the railway keep their road surface under the level crossing.
  if (railLine) {
    allLines.filter((line) => line.axis !== railLine.axis).forEach((line) => drawLine(grids.road, line, options));
  }
  addBuildings(random, grids, listLots(allLines, options));
  addWalkways(random, grids, allLines, options);
  return grids;
}
