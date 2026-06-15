import { createAuthClient } from "better-auth/svelte";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { PUBLIC_CONVEX_SITE_URL } from "$env/static/public";

export const authClient = createAuthClient({
	baseURL: PUBLIC_CONVEX_SITE_URL,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	plugins: [convexClient(), crossDomainClient() as any],
});

