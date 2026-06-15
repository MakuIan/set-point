import { getAuthState } from "@mmailaender/convex-better-auth-svelte/sveltekit";
import { redirect } from "@sveltejs/kit";

export const load = async ({ url }) => {
	const authState = getAuthState();
	const isAuthPage = url.pathname === '/login' || url.pathname === '/signup';

	if (!authState.isAuthenticated && !isAuthPage) {
		throw redirect(303, '/login');
	}
	if (authState.isAuthenticated && isAuthPage) {
		throw redirect(303, '/');
	}

	return {
		authState,
	};
};

