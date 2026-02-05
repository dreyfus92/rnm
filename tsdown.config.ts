import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  noExternal: ["@clack/prompts", "picocolors"],
});
