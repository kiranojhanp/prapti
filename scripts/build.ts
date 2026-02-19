import type { BuildConfig } from "bun";
import dts from "bun-plugin-dts";

const defaultBuildConfig: BuildConfig = {
  entrypoints: [
    "./src/index.ts",
    "./src/adapters/zod.ts",
    "./src/adapters/yup.ts",
    "./src/adapters/valibot.ts",
  ],
  outdir: "./dist",
  minify: true, // Enable minification
  sourcemap: "none", // Disable source maps for smaller builds
  target: "browser", // Target modern environments for smaller output
  splitting: false, // Disable code splitting for libraries
  external: ["zod"], // Don't bundle peer dependencies
  drop: ["console", "debugger"], // Remove console.log and debugger statements
  define: {
    "process.env.NODE_ENV": '"production"',
  },
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
