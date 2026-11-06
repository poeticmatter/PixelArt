import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset URLs, so the built viewer works from any sub-path such as
  // https://<user>.github.io/PixelArt/ as well as from the domain root.
  base: "./",
  test: {
    include: ["src/**/*.test.ts"],
  },
});
