import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { PUBLIC_CONVEX_SITE_URL } from '$env/static/public';

export const authClient = createAuthClient({
	// baseURL: PUBLIC_CONVEX_SITE_URL,
	plugins: [convexClient()]
});
