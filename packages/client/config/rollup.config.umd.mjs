import resolve from '@rollup/plugin-node-resolve';
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import babel from "@rollup/plugin-babel";

export default {
	input: "./build/esm/sockethub-client.js",
	output: [
		{
			file: "./dist/sockethub-client.js",
			format: "umd",
			name: "SockethubClient",
			sourcemap: true
		},
		{
			file: "./dist/sockethub-client.min.js",
			format: "umd",
			name: "SockethubClient",
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
