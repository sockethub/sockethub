import resolve from '@rollup/plugin-node-resolve';
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";

export default {
	input: "./build/esm/activity-streams.js",
	output: {
		file: "./dist/activity-streams.esm.min.js",
		format: "esm",
		sourcemap: true,
		plugins: [terser()]
	},
	plugins: [
		resolve({
			browser: true,
		}),
		commonjs(),
	],
}
