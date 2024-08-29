import resolve from "npm:@rollup/plugin-node-resolve";
import commonjs from "npm:@rollup/plugin-commonjs";
import terser from "npm:@rollup/plugin-terser";

export default {
  input: "./build/esm/activity-streams.js",
  output: {
    file: "./dist/activity-streams.esm.min.js",
    format: "esm",
    sourcemap: true,
    plugins: [terser()],
  },
  plugins: [
    resolve({
      browser: true,
    }),
    commonjs(),
  ],
};
