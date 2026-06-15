<script lang="ts">
	import './layout.css';
	import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { authClient } from '$lib/auth-client.ts';
	import type { InitialAuthState } from '@mmailaender/convex-better-auth-svelte/svelte';

	const { children, data } = $props();

	createSvelteAuthClient({
		authClient,
		getServerState: () => data.authState as InitialAuthState | undefined
	});
</script>

{@render children()}
