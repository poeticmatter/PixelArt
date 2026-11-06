import type { RandomSource } from "../random.ts";

export interface NoiseOptions {
  width: number;
  height: number;
  /** Size of the largest features, in cells. */
  featureSize: number;
  /** Extra layers of finer detail, each half the size and half the strength. */
  octaves: number;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Random values on a coarse lattice, smoothly interpolated: one octave of value noise. */
function createValueNoiseOctave(random: RandomSource, options: NoiseOptions, cellSize: number): number[][] {
  const latticeWidth = Math.ceil(options.width / cellSize) + 2;
  const latticeHeight = Math.ceil(options.height / cellSize) + 2;
  const lattice = Array.from({ length: latticeHeight }, () => Array.from({ length: latticeWidth }, random));
  const at = (x: number, y: number): number => lattice[y]?.[x] ?? 0;

  return Array.from({ length: options.height }, (_, y) =>
    Array.from({ length: options.width }, (_, x) => {
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      const tx = smoothstep((x % cellSize) / cellSize);
      const ty = smoothstep((y % cellSize) / cellSize);
      const top = at(cellX, cellY) * (1 - tx) + at(cellX + 1, cellY) * tx;
      const bottom = at(cellX, cellY + 1) * (1 - tx) + at(cellX + 1, cellY + 1) * tx;
      return top * (1 - ty) + bottom * ty;
    }),
  );
}

/** Fractal value noise normalised to [0, 1]: natural-looking blobs for terrain. */
export function generateNoiseField(random: RandomSource, options: NoiseOptions): number[][] {
  const field = Array.from({ length: options.height }, () => Array<number>(options.width).fill(0));
  let totalWeight = 0;
  for (let octave = 0; octave <= options.octaves; octave++) {
    const weight = 0.5 ** octave;
    const cellSize = Math.max(1, Math.round(options.featureSize / 2 ** octave));
    const layer = createValueNoiseOctave(random, options, cellSize);
    layer.forEach((row, y) => row.forEach((value, x) => {
      const fieldRow = field[y];
      if (fieldRow) {
        fieldRow[x] = (fieldRow[x] ?? 0) + value * weight;
      }
    }));
    totalWeight += weight;
  }
  return field.map((row) => row.map((value) => value / totalWeight));
}
