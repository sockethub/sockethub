import resolve from '@rollup/plugin-node-resolve';
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";

export default {
	input: "./build/esm/activity-streams.test.js",
	output: [
		{
			file: "./dist/activity-streams.test.js",
			format: "umd",
			name: "ASFactory",
			sourcemap: true
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
