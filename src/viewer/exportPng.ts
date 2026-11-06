import type { LibraryEntry } from "../core/types.ts";
import { drawAsset } from "./canvas.ts";

const PNG_MIME_TYPE = "image/png";
const OBJECT_URL_LIFETIME_MS = 10_000;

export function getExportFileName(id: string, scale: number): string {
  const baseName = id.split("/").pop() ?? id;
  return scale === 1 ? `${baseName}.png` : `${baseName}@${scale}x.png`;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("The browser could not encode the canvas as PNG."));
      }
    }, PNG_MIME_TYPE);
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoking synchronously can cancel the download in some browsers before it starts.
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
}

/** Saves the asset as a lossless PNG, without any viewer-only overlays such as the grid. */
export async function exportEntryAsPng(entry: LibraryEntry, scale: number): Promise<void> {
  const canvas = document.createElement("canvas");
  drawAsset(canvas, entry.asset, scale);
  const blob = await canvasToPngBlob(canvas);
  downloadBlob(blob, getExportFileName(entry.id, scale));
}
