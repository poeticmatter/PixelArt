/** A random number source in [0, 1). Seeded, so the same seed always gives the same map. */
export type RandomSource = () => number;

/** Mulberry32: tiny, fast and plenty random for level generation (not for security). */
export function createRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable value in [0, 1) for a grid position, e.g. to pick a tile variant without storing state. */
export function hashPosition(x: number, y: number, salt: number): number {
  let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

export function randomInteger(random: RandomSource, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}
