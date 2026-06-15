<script lang="ts">
	import SignupForm from "$lib/components/signup-form.svelte";
</script>

<svelte:head>
	<title>Sign Up – Set Point</title>
	<meta name="description" content="Create your Set Point account." />
</svelte:head>

<div class="grid min-h-svh lg:grid-cols-2">
	<div class="flex flex-col gap-4 p-6 md:p-10">
		<div class="flex justify-center gap-2 md:justify-start">
			<a href="/" class="flex items-center gap-2 font-medium">
				<div
					class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
						<circle cx="12" cy="12" r="10" />
						<path d="M12 8v8" />
						<path d="M8 12h8" />
					</svg>
				</div>
				Set Point
			</a>
		</div>
		<div class="flex flex-1 items-center justify-center">
			<div class="w-full max-w-xs">
				<SignupForm />
			</div>
		</div>
	</div>
	<div class="bg-muted relative hidden lg:block">
		<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
			<div class="flex flex-col items-center gap-4 px-12 text-center">
				<div class="bg-primary/10 flex size-20 items-center justify-center rounded-2xl backdrop-blur-sm">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-primary size-10">
						<circle cx="12" cy="12" r="10" />
						<path d="M12 8v8" />
						<path d="M8 12h8" />
					</svg>
				</div>
				<h2 class="text-foreground/80 text-2xl font-semibold">Set Point</h2>
				<p class="text-muted-foreground max-w-sm text-balance">
					Track your progress, analyze your game, and reach your full potential.
				</p>
			</div>
		</div>
	</div>
</div>
