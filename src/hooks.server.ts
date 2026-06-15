import type { Handle } from "@sveltejs/kit";
import { getToken } from "@mmailaender/convex-better-auth-svelte/sveltekit";
import { withServerConvexToken } from "convex-svelte/sveltekit/server";

export const handle: Handle = async ({ event, resolve }) => {
	const token = getToken(event.cookies);
	return withServerConvexToken(token, () => resolve(event));
};
