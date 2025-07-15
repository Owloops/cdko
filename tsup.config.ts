import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli/index.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  external: ["zx"],
  env: {
    GITHUB_SHA: process.env.GITHUB_SHA || "",
    BUILD_DATE: process.env.BUILD_DATE || "",
  },
});
