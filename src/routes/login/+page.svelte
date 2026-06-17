<script lang="ts">
	import LoginForm from '$lib/components/login-form.svelte';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Login – Set Point</title>
	<meta name="description" content="Sign in to your Set Point account." />
</svelte:head>

<div class="grid min-h-svh lg:grid-cols-2">
	<div class="flex flex-col gap-4 p-6 md:p-10">
		<div class="flex justify-center gap-2 md:justify-start">
			<a href={resolve('/')} class="flex items-center gap-2 font-medium">
				<img src="/logo.svg" alt="Set Point Logo" class="size-6" />
				Set Point
			</a>
		</div>
		<div class="flex flex-1 items-center justify-center">
			<div class="w-full max-w-xs">
				<LoginForm />
			</div>
		</div>
	</div>
	<div class="bg-muted relative hidden lg:block">
		<div
			class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-primary/10 via-primary/5 to-transparent"
		>
			<div class="flex flex-col items-center gap-4 px-12 text-center">
				<div
					class="bg-primary/10 flex size-20 items-center justify-center rounded-2xl backdrop-blur-sm"
				>
					<img src="/logo.svg" alt="Set Point Logo" class="size-14" />
				</div>
				<h2 class="text-foreground/80 text-2xl font-semibold">Set Point</h2>
				<p class="text-muted-foreground max-w-sm text-balance">
					Track your progress, analyze your game, and reach your full potential.
				</p>
			</div>
		</div>
	</div>
</div>
