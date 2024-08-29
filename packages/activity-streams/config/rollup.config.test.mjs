import resolve from "npm:@rollup/plugin-node-resolve";
import commonjs from "npm:@rollup/plugin-commonjs";
import babel from "npm:@rollup/plugin-babel";

export default {
  input: "./build/esm/activity-streams.test.js",
  output: [
    {
      file: "./dist/activity-streams.test.js",
      format: "umd",
      name: "ASFactory",
      sourcemap: true,
    },
  ],
  plugins: [
    resolve({
      browser: true,
    }),
    commonjs(),
    babel({
      babelHelpers: "bundled",
      presets: [["@babel/env"]],
      plugins: ["@babel/plugin-transform-object-assign"],
    }),
  ],
};
