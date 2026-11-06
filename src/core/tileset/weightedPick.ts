export const DEFAULT_WEIGHT = 1;

/** Picks an item by weight, using a roll in [0, 1) so callers control the randomness. */
export function pickWeighted<Item extends { weight?: number }>(items: Item[], roll: number): Item | undefined {
  const totalWeight = items.reduce((total, item) => total + (item.weight ?? DEFAULT_WEIGHT), 0);
  let remaining = roll * totalWeight;
  for (const item of items) {
    remaining -= item.weight ?? DEFAULT_WEIGHT;
    if (remaining < 0) {
      return item;
    }
  }
  return items.at(-1);
}
