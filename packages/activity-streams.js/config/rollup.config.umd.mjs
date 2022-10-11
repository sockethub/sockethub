import resolve from '@rollup/plugin-node-resolve';
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import babel from "@rollup/plugin-babel";
import multi from "@rollup/plugin-multi-entry"

export default {
	input: "./build/esm/**/*.js",
	output: [
		{
			dir: "./dist/",
			format: "umd",
			name: "ASFactory",
			sourcemap: true
		},
		{
			dir: "./dist/",
			format: "umd",
			name: "ASFactory",
			sourcemap: true,
			plugins: [terser()]
		},
	],
	plugins: [
		multi(),
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
