import resolve from '@rollup/plugin-node-resolve';
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import babel from "@rollup/plugin-babel";

export default {
	input: "./build/esm/activity-streams.js",
	output: [
		{
			file: "./dist/activity-streams.js",
			format: "umd",
			name: "ASFactory",
			sourcemap: true
		},
		{
			file: "./dist/activity-streams.min.js",
			format: "umd",
			name: "ASFactory",
			sourcemap: true,
			plugins: [terser()]
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
