import type { BuildConfig } from "bun";
import dts from "bun-plugin-dts";

const defaultBuildConfig: BuildConfig = {
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
};

const timeStart = performance.now();
await Promise.all([
  Bun.build({
    ...defaultBuildConfig,
    plugins: [dts()],
    format: "esm",
    naming: "[dir]/[name].esm.js",
  }),

  Bun.build({
    ...defaultBuildConfig,
    format: "cjs",
    naming: "[dir]/[name].cjs.js",
  }),
]);
const timeEnd = performance.now();

console.log(
  `⚡️ Build success in ${Math.round((timeEnd - timeStart) * 0.001)}s`
);
