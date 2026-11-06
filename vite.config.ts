import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset URLs, so the built viewer works from any sub-path such as
  // https://<user>.github.io/PixelArt/ as well as from the domain root.
  base: "./",
  build: {
    // The asset library is bundled on purpose. Pixel matrices are large as raw JSON but
    // gzip to a few percent of that, so the default 500 kB warning doesn't apply here.
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
