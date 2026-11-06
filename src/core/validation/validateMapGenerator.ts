import { CITY_ROLES } from "../types.ts";
import { isFields, isNonEmptyString } from "./primitives.ts";

const GENERATOR_TYPES = ["island", "hills", "city"];

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
  return validateCityRoles(generator.roles, terrainNames);
}
