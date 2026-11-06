import { describe, expect, it } from "vitest";

import { createRandom } from "../random.ts";
import type { CityGeneratorConfig } from "../types.ts";
import { type CityLayout, generateCityLayout } from "./cityGenerator.ts";
import type { Grid } from "./tileMap.ts";

const HEIGHTS = { building: 1, tower: 2, rail: 0, walkway: 1 };
const OPTIONS = { width: 40, height: 40, seed: 0 };
const SEEDS = [1, 2, 3, 4, 5, 6];

function generate(config: Partial<CityGeneratorConfig>, seed: number): CityLayout {
  return generateCityLayout(createRandom(seed), { type: "city", roles: {}, ...config }, HEIGHTS, { ...OPTIONS, seed });
}

function cells(grid: Grid): [number, number][] {
  return grid.flatMap((row, y) => row.flatMap((filled, x): [number, number][] => (filled ? [[x, y]] : [])));
}

const isFilled = (grid: Grid, x: number, y: number): boolean => grid[y]?.[x] ?? false;

describe("generateCityLayout", () => {
  it("lays roads roadWidth lanes wide", () => {
    const { grids } = generate({ roadWidth: 3 }, 1);
    const row = grids.road.find((cellsInRow) => !cellsInRow.every(Boolean)) ?? [];
    const runs = row.map(Number).join("").split("0").filter((run) => run.length > 0).map((run) => run.length);
    expect(runs.every((length) => length === 3)).toBe(true);
  });

  it("keeps buildings at least the setback plus one sidewalk cell away from roads", () => {
    const tooClose = SEEDS.some((seed) => {
      const { grids } = generate({ setback: 2, railElevation: 2 }, seed);
      return cells(grids.building).some(([x, y]) =>
        [-3, -2, -1, 1, 2, 3].some((offset) => isFilled(grids.road, x + offset, y) || isFilled(grids.road, x, y + offset)),
      );
    });
    expect(tooClose).toBe(false);
  });

  it("leaves every lot empty when openSpace is 1", () => {
    expect(cells(generate({ openSpace: 1 }, 1).grids.building)).toEqual([]);
  });

  it("makes the sidewalk everything that isn't road", () => {
    const { grids } = generate({}, 2);
    expect(grids.sidewalk.every((row, y) => row.every((filled, x) => filled !== isFilled(grids.road, x, y)))).toBe(true);
  });

  it("picks building heights from the range, and puts towers that many storeys higher", () => {
    const layouts = SEEDS.map((seed) => generate({ buildingHeight: [2, 4], towerHeight: [3, 9], towerChance: 1 }, seed));
    const isValid = layouts.every(({ grids, elevations }) => {
      const buildingOk = cells(grids.building).every(([x, y]) => {
        const height = elevations.building?.[y]?.[x] ?? 0;
        return height >= 2 && height <= 4;
      });
      const towerOk = cells(grids.tower).every(([x, y]) => {
        const rise = (elevations.tower?.[y]?.[x] ?? 0) - (elevations.building?.[y]?.[x] ?? 0);
        return rise >= 3 && rise <= 9;
      });
      return buildingOk && towerOk;
    });
    expect(isValid).toBe(true);
  });

  it("only places towers on buildings", () => {
    const { grids } = generate({ towerChance: 1 }, 3);
    expect(cells(grids.tower).every(([x, y]) => isFilled(grids.building, x, y))).toBe(true);
  });

  it("runs a raised railway over a road on a viaduct at railElevation", () => {
    const { grids, elevations } = generate({ railElevation: 3 }, 4);
    const rail = cells(grids.rail);
    expect([rail.length > 0, rail.every(([x, y]) => isFilled(grids.road, x, y)), elevations.rail?.[0]?.[0]]).toEqual([true, true, 3]);
  });

  it("runs a street-level railway in place of a road, crossing other roads", () => {
    const { grids } = generate({ railElevation: 0 }, 4);
    const rail = cells(grids.rail);
    const onRoad = rail.filter(([x, y]) => isFilled(grids.road, x, y)).length;
    expect(onRoad > 0 && onRoad < rail.length).toBe(true);
  });

  it("only bridges buildings that reach the walkway's height", () => {
    const tallEnough = SEEDS.every((seed) => {
      const { grids, elevations } = generate({ buildingHeight: [1, 4], walkwayElevation: 3 }, seed);
      return cells(grids.walkway).every(([x, y]) => {
        const neighbours: [number, number][] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        return neighbours
          .filter(([nx, ny]) => isFilled(grids.building, nx, ny))
          .every(([nx, ny]) => (elevations.building?.[ny]?.[nx] ?? 0) >= 3);
      });
    });
    expect(tallEnough).toBe(true);
  });
});

describe("generateCityLayout walkway density", () => {
  const countWalkways = (walkwayChance: number): number =>
    SEEDS.reduce((total, seed) => total + cells(generate({ walkwayChance }, seed).grids.walkway).length, 0);

  it("builds no walkways at a walkwayChance of 0", () => {
    expect(countWalkways(0)).toBe(0);
  });

  it("builds more walkways at a higher walkwayChance", () => {
    expect(countWalkways(0.9)).toBeGreaterThan(countWalkways(0.2));
  });
});
