<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useQuery, useMutation } from 'convex-svelte';
	import { api } from '../convex/_generated/api.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Dumbbell, Plus, Trash2, Edit3, Clock, ListPlus } from '@lucide/svelte';
	import type { Id, DataModel } from '../convex/_generated/dataModel.js';
	import type { DocumentByName } from 'convex/server';

	type SessionWithExercises = DocumentByName<DataModel, 'workoutSessions'> & {
		exercises: DocumentByName<DataModel, 'sessionExercises'>[];
	};

	// Convex Subscriptions & Mutations
	const sessionsQuery = useQuery(api.sessions.list);
	const createMutation = useMutation(api.sessions.create);
	const updateMutation = useMutation(api.sessions.update);
	const deleteMutation = useMutation(api.sessions.deleteSession);

	// Dialog & Form State
	let isDialogOpen = $state(false);
	let editingSession = $state<SessionWithExercises | null>(null);
	let name = $state('');
	let defaultSetsCount = $state<number>(3);
	let defaultRestTime = $state<number>(60);
	let hasWarmup = $state(false);
	let warmupDurationMinutes = $state(5);
	let hasCooldown = $state(false);
	let cooldownDurationMinutes = $state(5);
	let isSubmitting = $state(false);
	let triedSubmit = $state(false);

	// Form validation
	let nameError = $derived(name.trim() === '' ? 'Name is required' : '');
	let setsCountError = $derived(defaultSetsCount <= 0 ? 'Number of sets must be greater than 0' : '');
	let restTimeError = $derived(defaultRestTime <= 0 ? 'Rest time must be greater than 0' : '');
	let warmupError = $derived(hasWarmup && warmupDurationMinutes <= 0 ? 'Warm-up duration must be greater than 0' : '');
	let cooldownError = $derived(hasCooldown && cooldownDurationMinutes <= 0 ? 'Cool-down duration must be greater than 0' : '');
	let isValid = $derived(!nameError && !setsCountError && !restTimeError && !warmupError && !cooldownError);

	function openCreateDialog() {
		editingSession = null;
		name = '';
		defaultSetsCount = 3;
		defaultRestTime = 60;
		hasWarmup = false;
		warmupDurationMinutes = 5;
		hasCooldown = false;
		cooldownDurationMinutes = 5;
		triedSubmit = false;
		isDialogOpen = true;
	}

	function openEditDialog(session: SessionWithExercises) {
		editingSession = session;
		name = session.name;
		defaultSetsCount = session.defaultSetsCount;
		defaultRestTime = session.defaultRestTime;
		hasWarmup = session.warmupDuration !== null && session.warmupDuration !== undefined && session.warmupDuration > 0;
		warmupDurationMinutes = hasWarmup ? Math.round((session.warmupDuration as number) / 60) : 5;
		hasCooldown = session.cooldownDuration !== null && session.cooldownDuration !== undefined && session.cooldownDuration > 0;
		cooldownDurationMinutes = hasCooldown ? Math.round((session.cooldownDuration as number) / 60) : 5;
		triedSubmit = false;
		isDialogOpen = true;
	}

	async function handleSave() {
		triedSubmit = true;
		if (!isValid) return;
		isSubmitting = true;

		const warmupSecs = hasWarmup ? warmupDurationMinutes * 60 : null;
		const cooldownSecs = hasCooldown ? cooldownDurationMinutes * 60 : null;

		try {
			if (editingSession) {
				await updateMutation({
					sessionId: editingSession._id,
					name,
					defaultSetsCount,
					defaultRestTime,
					warmupDuration: warmupSecs,
					cooldownDuration: cooldownSecs
				});
			} else {
				await createMutation({
					name,
					defaultSetsCount,
					defaultRestTime,
					warmupDuration: warmupSecs,
					cooldownDuration: cooldownSecs
				});
			}
			isDialogOpen = false;
		} catch (err) {
			console.error(err);
			alert('Error saving session.');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete(sessionId: Id<'workoutSessions'>) {
		if (confirm('Do you really want to delete this session?')) {
			try {
				await deleteMutation({ sessionId });
			} catch (err) {
				console.error(err);
				alert('Error deleting session.');
			}
		}
	}

	let now = $state(Date.now());
	$effect(() => {
		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(interval);
	});

	// Formatting helper
	function formatDate(timestamp: number) {
		return new Date(timestamp).toLocaleDateString('en-US', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getRelativeTime(endedAt: number) {
		const diff = Math.max(0, Math.floor((now - endedAt) / 1000));
		if (diff < 60) return `${diff}s ago`;
		const mins = Math.floor(diff / 60);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}
</script>

<svelte:head>
	<title>Set Point - Dashboard</title>
	<meta
		name="description"
		content="Manage your workout sessions and track performance over time."
	/>
</svelte:head>

<!-- Page-level Context Menu wrapper -->
<ContextMenu.Root>
	<ContextMenu.Trigger class="w-full min-h-[80vh] flex flex-col focus:outline-hidden">
		<!-- Header Section -->
		<div class="mb-8">
			<div>
				<h1
					class="text-3xl font-extrabold tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent"
				>
					My Workout Sessions
				</h1>
				<p class="text-sm text-muted-foreground mt-1">
					Create, edit, and manage your workouts. <span class="font-medium text-foreground"
						>Right-click</span
					> anywhere on the background for quick actions.
				</p>
			</div>
		</div>

		<!-- Main Content Area -->
		<div class="flex-1 flex flex-col">
			{#if sessionsQuery.isLoading}
				<!-- Skeleton Loading State -->
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
					{#each Array(6) as _, i (i)}
						<div
							class="border border-border/50 bg-card/60 p-5 rounded-xl flex flex-col justify-between h-full min-h-[140px]"
						>
							<div class="space-y-2">
								<Skeleton class="h-4 w-2/3" />
								<Skeleton class="h-3.5 w-1/3" />
							</div>
							<div class="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
								<div class="flex gap-4">
									<Skeleton class="h-3.5 w-12" />
									<Skeleton class="h-3.5 w-12" />
								</div>
								<div class="flex gap-1">
									<Skeleton class="size-7 rounded-full" />
									<Skeleton class="size-7 rounded-full" />
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else if sessionsQuery.data && sessionsQuery.data.length === 0}
				<!-- Premium Empty State -->
				<div
					class="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-border/60 rounded-2xl bg-muted/10 backdrop-blur-xs min-h-87.5 text-center"
				>
					<Empty.Root>
						<Empty.Header>
							<Empty.Media
								variant="icon"
								class="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4"
							>
								<Dumbbell class="size-8" />
							</Empty.Media>
							<Empty.Title class="text-xl font-bold">No Workout Sessions</Empty.Title>
							<Empty.Description class="text-sm text-muted-foreground max-w-sm mt-1">
								No sessions recorded yet. Click the button below or right-click on the background to
								get started.
							</Empty.Description>
						</Empty.Header>
						<Empty.Content class="mt-6">
							<Button
								onclick={openCreateDialog}
								size="lg"
								class="rounded-full shadow-sm hover:shadow-md transition-all"
							>
								<Plus class="mr-2 size-5" /> Create First Session
							</Button>
						</Empty.Content>
					</Empty.Root>
				</div>
			{:else if sessionsQuery.data}
				<!-- Workout Sessions Grid -->
				<Item.Group class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
					{#each sessionsQuery.data as session (session._id)}
						<ContextMenu.Root>
							<ContextMenu.Trigger class="w-full h-full">
								<Item.Root
									class="group/session relative overflow-hidden border border-border/50 bg-card/60 p-5 shadow-xs hover:shadow-md hover:scale-[1.01] hover:border-primary/20 transition-all duration-200 cursor-pointer rounded-xl flex flex-col justify-between h-full min-h-[140px] focus-visible:ring-2 focus-visible:ring-primary/50"
									variant="outline"
									onclick={() => goto(resolve(`/sessions/${session._id}`))}
								>
									<!-- Top Details: Title & Status -->
									<div class="flex items-start justify-between gap-4">
										<div class="space-y-1">
											<Item.Title
												class="text-sm font-bold tracking-tight text-foreground/90 group-hover/session:text-primary transition-colors"
											>
												{session.name}
											</Item.Title>
											<p class="text-[10px] text-muted-foreground">
												{#if session.status === 'completed' && (session.timerEndTime || session.endedAt)}
													Finished {getRelativeTime((session.timerEndTime || session.endedAt) as number)}
												{:else}
													Started {formatDate(session.startedAt)}
												{/if}
											</p>
										</div>
										{#if session.status === 'active'}
											<span
												class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400"
											>
												Active
											</span>
										{:else}
											<span
												class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border"
											>
												Completed
											</span>
										{/if}
									</div>

									<!-- Bottom Details: Default Sets, Rest Time & Actions -->
									<div class="flex items-end justify-between mt-6 pt-4 border-t border-border/30">
										<div class="flex flex-nowrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground max-w-[70%]">
											<div class="flex items-center gap-1.5">
												<ListPlus class="size-3.5 text-primary/60" />
												<span>{session.defaultSetsCount} Sets</span>
											</div>
											<div class="flex items-center gap-1.5">
												<Clock class="size-3.5 text-primary/60" />
												<span>{session.defaultRestTime}s Rest</span>
											</div>
											{#if session.warmupDuration}
												<span class="inline-flex items-center px-1.5 py-0.25 rounded-sm bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold text-[9px] uppercase tracking-wider">
													Warm-up
												</span>
											{/if}
											{#if session.cooldownDuration}
												<span class="inline-flex items-center px-1.5 py-0.25 rounded-sm bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold text-[9px] uppercase tracking-wider">
													Cool-down
												</span>
											{/if}
										</div>

										<!-- Explicit Action Buttons (Visible on hover, accessible always) -->
										<div class="flex items-center gap-1">
											<Button
												variant="ghost"
												size="icon-sm"
												onclick={(e) => {
													e.stopPropagation();
													openEditDialog(session);
												}}
												class="hover:bg-primary/10 hover:text-primary rounded-full transition-colors size-7"
												title="Edit"
											>
												<Edit3 class="size-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="icon-sm"
												onclick={(e) => {
													e.stopPropagation();
													handleDelete(session._id);
												}}
												class="hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-full transition-colors size-7"
												title="Delete"
											>
												<Trash2 class="size-3.5" />
											</Button>
										</div>
									</div>
								</Item.Root>
							</ContextMenu.Trigger>
							<ContextMenu.Content class="w-40">
								<ContextMenu.Item onclick={() => openEditDialog(session)}>
									<Edit3 class="mr-2 size-3.5 text-muted-foreground" /> Edit
								</ContextMenu.Item>
								<ContextMenu.Separator />
								<ContextMenu.Item onclick={() => handleDelete(session._id)} variant="destructive">
									<Trash2 class="mr-2 size-3.5 text-destructive" /> Delete
								</ContextMenu.Item>
							</ContextMenu.Content>
						</ContextMenu.Root>
					{/each}
				</Item.Group>
			{/if}
		</div>
	</ContextMenu.Trigger>

	<!-- Page-level Context Menu Option (Right-click on background) -->
	<ContextMenu.Content class="w-48">
		<ContextMenu.Item onclick={openCreateDialog}>
			<Plus class="mr-2 size-4 text-primary" /> Add New Session
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>

<!-- Creation & Edit Dialog -->
<Dialog.Root bind:open={isDialogOpen}>
	<Dialog.Content class="sm:max-w-md bg-card border border-border/80 shadow-lg">
		<Dialog.Header>
			<Dialog.Title class="text-lg font-bold">
				{editingSession ? 'Edit Workout Session' : 'Create New Workout Session'}
			</Dialog.Title>
			<Dialog.Description class="text-xs text-muted-foreground">
				{editingSession
					? 'Adjust the exercise details of your session.'
					: 'Enter the name of the exercise and your target defaults for sets and rest time.'}
			</Dialog.Description>
		</Dialog.Header>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				triedSubmit = true;
				if (isValid) handleSave();
			}}
			class="space-y-4 py-4"
		>
			<!-- Name Field -->
			<div class="space-y-1.5">
				<Label for="session-name">Session Name</Label>
				<Input
					id="session-name"
					type="text"
					bind:value={name}
					placeholder="e.g. Push Day, Leg Day"
					aria-invalid={triedSubmit && nameError !== ''}
				/>
				{#if triedSubmit && nameError}
					<span class="text-[10px] text-destructive leading-none block mt-1">{nameError}</span>
				{/if}
			</div>

			<!-- Grid for Sets & Rest Time -->
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<Label for="session-sets">Default Sets</Label>
					<Input
						id="session-sets"
						type="number"
						min="1"
						bind:value={defaultSetsCount}
						aria-invalid={triedSubmit && setsCountError !== ''}
					/>
					{#if triedSubmit && setsCountError}
						<span class="text-[10px] text-destructive leading-none block mt-1"
							>{setsCountError}</span
						>
					{/if}
				</div>

				<div class="space-y-1.5">
					<Label for="session-rest">Default Rest Time (Seconds)</Label>
					<Input
						id="session-rest"
						type="number"
						min="5"
						step="5"
						bind:value={defaultRestTime}
						aria-invalid={triedSubmit && restTimeError !== ''}
					/>
					{#if triedSubmit && restTimeError}
						<span class="text-[10px] text-destructive leading-none block mt-1">{restTimeError}</span>
					{/if}
				</div>
			</div>

			<!-- Warm-up Toggle & Input -->
			<div class="space-y-3 border-t border-border/20 pt-4 mt-2">
				<div class="flex items-center justify-between">
					<Label for="session-warmup-toggle" class="cursor-pointer font-medium">Add Warm-up Timer</Label>
					<input
						id="session-warmup-toggle"
						type="checkbox"
						bind:checked={hasWarmup}
						class="rounded-sm border-border text-primary focus:ring-primary size-4"
					/>
				</div>
				{#if hasWarmup}
					<div class="space-y-1.5 pl-6">
						<Label for="session-warmup-duration">Warm-up Duration (Minutes)</Label>
						<Input
							id="session-warmup-duration"
							type="number"
							min="1"
							bind:value={warmupDurationMinutes}
							aria-invalid={triedSubmit && warmupError !== ''}
						/>
						{#if triedSubmit && warmupError}
							<span class="text-[10px] text-destructive leading-none block mt-1">{warmupError}</span>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Cool-down Toggle & Input -->
			<div class="space-y-3 border-t border-border/20 pt-4">
				<div class="flex items-center justify-between">
					<Label for="session-cooldown-toggle" class="cursor-pointer font-medium">Add Cool-down Timer</Label>
					<input
						id="session-cooldown-toggle"
						type="checkbox"
						bind:checked={hasCooldown}
						class="rounded-sm border-border text-primary focus:ring-primary size-4"
					/>
				</div>
				{#if hasCooldown}
					<div class="space-y-1.5 pl-6">
						<Label for="session-cooldown-duration">Cool-down Duration (Minutes)</Label>
						<Input
							id="session-cooldown-duration"
							type="number"
							min="1"
							bind:value={cooldownDurationMinutes}
							aria-invalid={triedSubmit && cooldownError !== ''}
						/>
						{#if triedSubmit && cooldownError}
							<span class="text-[10px] text-destructive leading-none block mt-1">{cooldownError}</span>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Form Actions -->
			<Dialog.Footer class="pt-4 flex gap-2 justify-end">
				<Dialog.Close>
					<Button type="button" variant="outline" class="rounded-full">Cancel</Button>
				</Dialog.Close>
				<Button type="submit" disabled={isSubmitting} class="rounded-full shadow-xs">
					{isSubmitting ? 'Saving...' : 'Save'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
