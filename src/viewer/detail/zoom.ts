/** Integer zoom steps only: fractional scales would blur or unevenly size pixels. */
export const ZOOM_LEVELS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64] as const;

const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? MIN_ZOOM;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
}

export function getNextZoomIn(zoom: number): number {
  return ZOOM_LEVELS.find((level) => level > zoom) ?? MAX_ZOOM;
}

export function getNextZoomOut(zoom: number): number {
  return [...ZOOM_LEVELS].reverse().find((level) => level < zoom) ?? MIN_ZOOM;
}
