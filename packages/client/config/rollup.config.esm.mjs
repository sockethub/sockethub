import resolve from '@rollup/plugin-node-resolve';
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";

export default {
	input: "./build/esm/sockethub-client.js",
	output: {
		file: "./dist/sockethub-client.esm.min.js",
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
