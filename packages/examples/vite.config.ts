import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';

const config: UserConfig = {
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ["highlight.js", "highlight.js/lib/core", "@sockethub/client"],
	},
	server: {
		strictPort: true,
		port: 10551
	}
};

export default config;
