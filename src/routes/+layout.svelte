<script lang="ts">
	import './layout.css';
	import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { authClient } from '$lib/auth-client';
	import type { InitialAuthState, AuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { LogOut } from '@lucide/svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { setupConvex } from 'convex-svelte';

	const { children, data } = $props();

	setupConvex(PUBLIC_CONVEX_URL, {
		expectAuth: true
	});

	createSvelteAuthClient({
		authClient: authClient as unknown as AuthClient,
		getServerState: () => data.authState as InitialAuthState | undefined,
		
	});

	const session = authClient.useSession();

	async function handleLogout() {
		await authClient.signOut();
		goto(resolve('/login'));
	}
</script>

{#if $session.data && page.url.pathname !== '/login' && page.url.pathname !== '/signup'}
	<div class="min-h-screen bg-background flex flex-col">
		<!-- Main App Header -->
		<header
			class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md"
		>
			<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
				<!-- Left: Logo & App Name -->
				<div class="flex items-center gap-2">
					<a href={resolve('/')} class="flex items-center gap-2 font-medium">
						<img src="/logo.svg" alt="Set Point Logo" class="size-8" />
						<span
							class="bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-lg font-bold tracking-tight text-transparent"
						>
							Set Point
						</span>
					</a>
				</div>

				<!-- Right: User and Logout -->
				<div class="flex items-center gap-4">
					{#if $session.data.user}
						<div class="flex items-center gap-3">
							<div class="hidden text-right sm:block">
								<p class="text-sm font-medium leading-none text-foreground">
									{$session.data.user.name}
								</p>
								<p class="mt-0.5 text-xs text-muted-foreground leading-none">
									{$session.data.user.email}
								</p>
							</div>
							<div
								class="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold text-sm shadow-inner ring-1 ring-border"
							>
								{($session.data.user.name || $session.data.user.email || 'U')
									.substring(0, 2)
									.toUpperCase()}
							</div>
						</div>
					{/if}

					<Button
						variant="ghost"
						size="icon"
						onclick={handleLogout}
						class="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
						title="Abmelden"
					>
						<LogOut class="size-5" />
						<span class="sr-only">Logout</span>
					</Button>
				</div>
			</div>
		</header>

		<!-- Page Content -->
		<main class="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
