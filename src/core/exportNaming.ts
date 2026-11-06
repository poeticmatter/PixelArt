/** "cats/cat" at scale 4 → "cats/cat@4x"; scale 1 has no suffix. Shared so CLI and viewer name files alike. */
export function getExportStem(id: string, scale: number): string {
  return scale === 1 ? id : `${id}@${scale}x`;
}

export function getBaseName(stem: string): string {
  return stem.slice(stem.lastIndexOf("/") + 1);
}
