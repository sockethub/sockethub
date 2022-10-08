import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';

const config: UserConfig = {
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['@sockethub/activity-streams', '@sockethub/client', 'event-emitter']
	}
};

export default config;
