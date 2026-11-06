import type { RgbaImage } from "../../core/render.ts";
import { drawRgbaImage } from "../canvas.ts";

const PNG_MIME_TYPE = "image/png";
const OBJECT_URL_LIFETIME_MS = 10_000;

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

/** Saves an image as a lossless PNG. */
export async function downloadPng(image: RgbaImage, fileName: string): Promise<void> {
  const canvas = document.createElement("canvas");
  drawRgbaImage(canvas, image);
  downloadBlob(await canvasToPngBlob(canvas), fileName);
}

export function downloadJson(value: unknown, fileName: string): void {
  downloadBlob(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" }), fileName);
}

/** Runs a download and tells the user if it fails, rather than failing silently in the console. */
export function runDownload(description: string, download: () => Promise<void> | void): void {
  Promise.resolve()
    .then(download)
    .catch((error: unknown) => {
      console.error(`Failed to export ${description}`, error);
      alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    });
}
