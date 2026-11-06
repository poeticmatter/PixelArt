import { buildLibrary, type Library } from "../core/library.ts";

const LIBRARY_PREFIX = "/library/";

/**
 * Vite bundles every JSON file under library/ at build time; in dev, adding or
 * editing an asset reloads the page, so the gallery always reflects the folder.
 */
const assetModules: Record<string, unknown> = import.meta.glob("/library/**/*.json", {
  eager: true,
  import: "default",
});

export function loadLibraryFromBundle(): Library {
  const files = Object.entries(assetModules).map(([modulePath, json]) => ({
    relativePath: modulePath.slice(LIBRARY_PREFIX.length),
    json,
  }));
  return buildLibrary(files);
}
