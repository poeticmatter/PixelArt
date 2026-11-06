import { CITY_ROLES } from "../types.ts";
import { type Fields, isFields, isIntegerInRange, isIntegerRangePair, isNonEmptyString, isProbability, MAX_ELEVATION } from "./primitives.ts";

const GENERATOR_TYPES = ["island", "hills", "city"];

/** Bounds for the city options; beyond these the generated maps stop making sense. */
const CITY_LIMITS = {
  blockSize: { min: 1, max: 32 },
  roadWidth: { min: 1, max: 6 },
  setback: { min: 0, max: 6 },
};

function validateCityRoles(roles: unknown, terrainNames: unknown[]): string[] {
  if (!isFields(roles)) {
    return [`"generator.roles" must map city features to terrain names, e.g. { "road": "asphalt" }.`];
  }
  return Object.entries(roles).flatMap(([role, terrainName]) => {
    if (!CITY_ROLES.some((knownRole) => knownRole === role)) {
      return [`"generator.roles.${role}" is not a city feature; use ${CITY_ROLES.map((name) => `"${name}"`).join(", ")}.`];
    }
    if (!isNonEmptyString(terrainName) || !terrainNames.includes(terrainName)) {
      return [`"generator.roles.${role}" must name one of the tileset's terrains, got ${JSON.stringify(terrainName)}.`];
    }
    return [];
  });
}

/** Each optional city setting: absent, or within its allowed range. */
function validateCityOptions(generator: Fields): string[] {
  const checks: [string, boolean, string][] = [
    ["blockSize", isIntegerRangePair(generator.blockSize, CITY_LIMITS.blockSize.min, CITY_LIMITS.blockSize.max), `[min, max] cells from ${CITY_LIMITS.blockSize.min} to ${CITY_LIMITS.blockSize.max}`],
    ["roadWidth", isIntegerInRange(generator.roadWidth, CITY_LIMITS.roadWidth.min, CITY_LIMITS.roadWidth.max), `an integer from ${CITY_LIMITS.roadWidth.min} to ${CITY_LIMITS.roadWidth.max}`],
    ["setback", isIntegerInRange(generator.setback, CITY_LIMITS.setback.min, CITY_LIMITS.setback.max), `an integer from ${CITY_LIMITS.setback.min} to ${CITY_LIMITS.setback.max}`],
    ["openSpace", isProbability(generator.openSpace), "a number from 0 to 1"],
    ["buildingHeight", isIntegerRangePair(generator.buildingHeight, 1, MAX_ELEVATION), `[min, max] storeys from 1 to ${MAX_ELEVATION}`],
    ["towerHeight", isIntegerRangePair(generator.towerHeight, 1, MAX_ELEVATION), `[min, max] storeys from 1 to ${MAX_ELEVATION}`],
    ["towerChance", isProbability(generator.towerChance), "a number from 0 to 1"],
    ["railElevation", isIntegerInRange(generator.railElevation, 0, MAX_ELEVATION), `an integer from 0 to ${MAX_ELEVATION}`],
    ["walkwayElevation", isIntegerInRange(generator.walkwayElevation, 0, MAX_ELEVATION), `an integer from 0 to ${MAX_ELEVATION}`],
    ["walkwayChance", isProbability(generator.walkwayChance), "a number from 0 to 1"],
  ];
  return checks
    .filter(([key, isValid]) => generator[key] !== undefined && !isValid)
    .map(([key, , expected]) => `"generator.${key}" must be ${expected} when present.`);
}

/** Checks the optional `generator` field against the tileset's terrain names. */
export function validateMapGenerator(generator: unknown, terrains: unknown[]): string[] {
  if (generator === undefined) {
    return [];
  }
  if (!isFields(generator) || !GENERATOR_TYPES.includes(String(generator.type))) {
    return [`"generator.type" must be one of "${GENERATOR_TYPES.join(`", "`)}" when present.`];
  }
  if (generator.type !== "city") {
    return [];
  }
  const terrainNames = terrains.map((terrain) => (isFields(terrain) ? terrain.name : undefined));
  return [...validateCityRoles(generator.roles, terrainNames), ...validateCityOptions(generator)];
}
