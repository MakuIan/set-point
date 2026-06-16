<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useQuery, useMutation } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import {
		Dumbbell,
		Plus,
		Trash2,
		Edit3,
		Clock,
		ListPlus,
		ArrowUp,
		ArrowDown,
		ChevronLeft,
		Check,
		Play,
		Square,
		Award
	} from '@lucide/svelte';
	import type { Id } from '../../../convex/_generated/dataModel.js';

	// Types
	type SessionExercise = {
		_id: Id<'sessionExercises'>;
		_creationTime: number;
		sessionId: Id<'workoutSessions'>;
		name: string;
		setsCount: number;
		restTime: number;
		description?: string;
		order: number;
	};

	const sessionId = $derived(page.params.id as Id<'workoutSessions'>);

	// Convex Queries & Mutations
	const sessionQuery = $derived(
		useQuery(api.sessions.get, () => ({
			sessionId
		}))
	);

	const addExerciseMutation = useMutation(api.sessions.addExercise);
	const updateExerciseMutation = useMutation(api.sessions.updateExercise);
	const deleteExerciseMutation = useMutation(api.sessions.deleteExercise);
	const moveExerciseMutation = useMutation(api.sessions.moveExercise);
	const updatePlayerStateMutation = useMutation(api.sessions.updatePlayerState);
	const finishSessionMutation = useMutation(api.sessions.finish);
	const resumeSessionMutation = useMutation(api.sessions.resume);

	// Dialog & Form State
	let isExerciseDialogOpen = $state(false);
	let editingExercise = $state<SessionExercise | null>(null);

	let exerciseName = $state('');
	let exerciseSets = $state(3);
	let exerciseRest = $state(60);
	let exerciseDescription = $state('');
	let triedExerciseSubmit = $state(false);

	// Validation
	let exerciseNameError = $derived(exerciseName.trim() === '' ? 'Name is required' : '');
	let exerciseSetsError = $derived(exerciseSets <= 0 ? 'Sets must be greater than 0' : '');
	let exerciseRestError = $derived(exerciseRest <= 0 ? 'Rest time must be greater than 0' : '');
	let isExerciseFormValid = $derived(
		!exerciseNameError && !exerciseSetsError && !exerciseRestError
	);

	// Timer State & Sync
	let remainingTime = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	let timeSinceFinished = $state(0);
	let finishedTimerInterval: ReturnType<typeof setInterval> | null = null;

	function formatTime(seconds: number) {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0) return `${h}h ${m}m ${s}s`;
		if (m > 0) return `${m}m ${s}s`;
		return `${s}s`;
	}

	$effect(() => {
		const sessionData = sessionQuery?.data;
		if (sessionData && sessionData.status === 'completed' && sessionData.timerEndTime) {
			const updateTimer = () => {
				timeSinceFinished = Math.max(
					0,
					Math.floor((Date.now() - sessionData.timerEndTime!) / 1000)
				);
			};
			updateTimer();
			finishedTimerInterval = setInterval(updateTimer, 1000);
		} else {
			timeSinceFinished = 0;
			if (finishedTimerInterval) {
				clearInterval(finishedTimerInterval);
				finishedTimerInterval = null;
			}
		}

		return () => {
			if (finishedTimerInterval) {
				clearInterval(finishedTimerInterval);
				finishedTimerInterval = null;
			}
		};
	});

	// Reactively handle the countdown rest timer
	$effect(() => {
		const sessionData = sessionQuery?.data;
		if (sessionData && sessionData.timerEndTime && sessionData.status === 'active') {
			const updateTimer = () => {
				const diff = Math.ceil((sessionData.timerEndTime! - Date.now()) / 1000);
				remainingTime = Math.max(0, diff);
				if (diff <= 0 && timerInterval) {
					clearInterval(timerInterval);
					timerInterval = null;
				}
			};
			updateTimer();
			timerInterval = setInterval(updateTimer, 1000);
		} else {
			remainingTime = 0;
			if (timerInterval) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
		}

		return () => {
			if (timerInterval) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
		};
	});

	// Derived metrics for the progress bar
	let progressPercentage = $derived(
		sessionQuery?.data && sessionQuery.data.timerDuration > 0
			? (remainingTime / sessionQuery.data.timerDuration) * 100
			: 0
	);

	// Exercise Form Action Handlers
	function openAddExercise() {
		editingExercise = null;
		exerciseName = '';
		exerciseSets = sessionQuery?.data?.defaultSetsCount ?? 3;
		exerciseRest = sessionQuery?.data?.defaultRestTime ?? 60;
		exerciseDescription = '';
		triedExerciseSubmit = false;
		isExerciseDialogOpen = true;
	}

	function openEditExercise(exercise: SessionExercise) {
		editingExercise = exercise;
		exerciseName = exercise.name;
		exerciseSets = exercise.setsCount;
		exerciseRest = exercise.restTime;
		exerciseDescription = exercise.description || '';
		triedExerciseSubmit = false;
		isExerciseDialogOpen = true;
	}

	async function handleSaveExercise() {
		triedExerciseSubmit = true;
		if (!isExerciseFormValid || !sessionQuery.data) return;

		try {
			if (editingExercise) {
				await updateExerciseMutation({
					sessionId,
					exerciseId: editingExercise._id,
					name: exerciseName,
					setsCount: exerciseSets,
					restTime: exerciseRest,
					description: exerciseDescription || undefined
				});
			} else {
				await addExerciseMutation({
					sessionId,
					name: exerciseName,
					setsCount: exerciseSets,
					restTime: exerciseRest,
					description: exerciseDescription || undefined
				});
			}
			isExerciseDialogOpen = false;
		} catch (err) {
			console.error(err);
			alert('Failed to save exercise.');
		}
	}

	async function handleDeleteExercise(exerciseId: Id<'sessionExercises'>) {
		if (confirm('Are you sure you want to remove this exercise?')) {
			try {
				await deleteExerciseMutation({
					sessionId,
					exerciseId
				});
			} catch (err) {
				console.error(err);
				alert('Failed to delete exercise.');
			}
		}
	}

	async function handleMoveExercise(exerciseId: Id<'sessionExercises'>, direction: 'up' | 'down') {
		try {
			await moveExerciseMutation({
				sessionId,
				exerciseId,
				direction
			});
		} catch (err) {
			console.error(err);
		}
	}

	// Live Player Handlers
	async function handleLogSet() {
		if (!sessionQuery?.data) return;
		const session = sessionQuery.data;
		const exercises = session.exercises;
		if (exercises.length === 0) return;

		const currentExercise = exercises[session.currentExerciseIndex];
		let nextExerciseIndex = session.currentExerciseIndex;
		let nextSet = session.currentSet;
		let nextTimerEndTime = null;

		if (nextSet < currentExercise.setsCount) {
			nextSet++;
			nextTimerEndTime = Date.now() + currentExercise.restTime * 1000;
		} else {
			// Finished all sets for this exercise, move to next
			if (nextExerciseIndex < exercises.length - 1) {
				nextExerciseIndex++;
				nextSet = 1;
				nextTimerEndTime = Date.now() + currentExercise.restTime * 1000;
			} else {
				// Mark as fully done
				nextSet = currentExercise.setsCount + 1;
			}
		}

		await updatePlayerStateMutation({
			sessionId: session._id,
			currentExerciseIndex: nextExerciseIndex,
			currentSet: nextSet,
			timerEndTime: nextTimerEndTime,
			timerDuration: currentExercise.restTime
		});
	}

	async function handleSkipRest() {
		if (!sessionQuery?.data) return;
		await updatePlayerStateMutation({
			sessionId,
			currentExerciseIndex: sessionQuery.data.currentExerciseIndex,
			currentSet: sessionQuery.data.currentSet,
			timerEndTime: null,
			timerDuration: sessionQuery.data.timerDuration
		});
	}

	async function handleAddRestTime(seconds: number) {
		if (!sessionQuery?.data || !sessionQuery.data.timerEndTime) return;
		const currentEndTime = sessionQuery.data.timerEndTime;
		const nextEndTime = currentEndTime + seconds * 1000;

		await updatePlayerStateMutation({
			sessionId,
			currentExerciseIndex: sessionQuery.data.currentExerciseIndex,
			currentSet: sessionQuery.data.currentSet,
			timerEndTime: nextEndTime,
			timerDuration: sessionQuery.data.timerDuration + seconds
		});
	}

	async function handleGoBack() {
		if (!sessionQuery?.data) return;
		const session = sessionQuery.data;
		const exercises = session.exercises;
		if (exercises.length === 0) return;

		let prevExerciseIndex = session.currentExerciseIndex;
		let prevSet = session.currentSet;

		// If currently shown completed (setsCount + 1), clamp to setsCount
		if (prevSet > exercises[prevExerciseIndex].setsCount) {
			prevSet = exercises[prevExerciseIndex].setsCount;
		} else if (prevSet > 1) {
			prevSet--;
		} else if (prevExerciseIndex > 0) {
			prevExerciseIndex--;
			prevSet = exercises[prevExerciseIndex].setsCount;
		}

		await updatePlayerStateMutation({
			sessionId: session._id,
			currentExerciseIndex: prevExerciseIndex,
			currentSet: prevSet,
			timerEndTime: null,
			timerDuration: exercises[prevExerciseIndex].restTime
		});
	}

	let isFinishDialogOpen = $state(false);

	async function handleFinishSession() {
		isFinishDialogOpen = true;
	}

	async function confirmFinishSession() {
		if (!sessionQuery?.data) return;
		try {
			await finishSessionMutation({ sessionId: sessionQuery.data._id });
			isFinishDialogOpen = false;
		} catch (err) {
			console.error(err);
			alert('Failed to finish workout session.');
		}
	}

	async function handleResumeSession() {
		if (!sessionQuery?.data) return;
		try {
			await resumeSessionMutation({ sessionId: sessionQuery.data._id });
		} catch (err) {
			console.error(err);
			alert('Failed to resume workout session.');
		}
	}
</script>

<svelte:head>
	<title>Set Point - Active Session</title>
</svelte:head>

<div class="space-y-6">
	<!-- Back link & Header -->
	<div class="flex flex-col gap-2">
		<a
			href={resolve('/')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-fit"
		>
			<ChevronLeft class="size-4" />
			Back to Dashboard
		</a>

		<div class="flex flex-wrap items-center justify-between gap-4 mt-2">
			<div>
				{#if sessionQuery.isLoading}
					<Skeleton class="h-8 w-48 mb-1" />
					<Skeleton class="h-4 w-32" />
				{:else if sessionQuery.data}
					<div class="flex items-center gap-3">
						<h1
							class="text-2xl sm:text-3xl font-extrabold tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent"
						>
							{sessionQuery.data.status === 'active'
								? 'Active Workout Session'
								: 'Completed Session'}
						</h1>
						{#if sessionQuery.data.status === 'active'}
							<span
								class="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400"
							>
								Live
							</span>
						{:else}
							<span
								class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-border"
							>
								Completed
							</span>
						{/if}
					</div>
					<p class="text-sm text-muted-foreground mt-1">
						{sessionQuery.data.status === 'active'
							? 'Perform your sets, log progress, and rest using the timer.'
							: `Logged on ${new Date(sessionQuery.data.startedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}.`}
					</p>
				{/if}
			</div>

			{#if sessionQuery.data && sessionQuery.data.status === 'active'}
				<Button
					variant="default"
					size="lg"
					onclick={handleFinishSession}
					class="rounded-full shadow-md hover:shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all"
				>
					<Check class="mr-2 size-5" /> Finish Workout
				</Button>
			{/if}
		</div>
	</div>

	<!-- Main Body Layout -->
	{#if sessionQuery.isLoading}
		<!-- Loading Skeleton Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<div class="lg:col-span-2 space-y-4">
				<Skeleton class="h-10 w-40 mb-2" />
				<!-- eslint-disable-next-line svelte/require-key-when-iterating, @typescript-eslint/no-unused-vars -->
				{#each Array(3) as _, i (i)}
					<Skeleton class="h-32 w-full rounded-xl" />
				{/each}
			</div>
			<div>
				<Skeleton class="h-80 w-full rounded-xl" />
			</div>
		</div>
	{:else if sessionQuery.data}
		{@const session = sessionQuery.data}
		{@const exercises = session.exercises || []}

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
			<!-- Exercises List Column -->
			<div class="lg:col-span-2 space-y-4">
				<div class="flex items-center justify-between mb-2">
					<h2 class="text-xl font-bold tracking-tight">Session Exercises</h2>
					{#if session.status === 'active'}
						<Button
							variant="outline"
							size="sm"
							onclick={openAddExercise}
							class="rounded-full border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
						>
							<Plus class="mr-1.5 size-4" /> Add Exercise
						</Button>
					{/if}
				</div>

				{#if exercises.length === 0}
					<div
						class="flex flex-col items-center justify-center p-8 border border-dashed border-border/60 rounded-2xl bg-muted/10 backdrop-blur-xs min-h-[300px] text-center w-full"
					>
						<Empty.Root>
							<Empty.Header>
								<Empty.Media
									variant="icon"
									class="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4"
								>
									<ListPlus class="size-8" />
								</Empty.Media>
								<Empty.Title class="text-xl font-bold">No Exercises Added</Empty.Title>
								<Empty.Description class="text-sm text-muted-foreground max-w-sm mt-1">
									Add exercises to this workout session to start tracking your sets and rest times.
								</Empty.Description>
							</Empty.Header>
							{#if session.status === 'active'}
								<Empty.Content class="mt-6">
									<Button
										onclick={openAddExercise}
										size="lg"
										class="rounded-full shadow-sm hover:shadow-md transition-all"
									>
										<Plus class="mr-2 size-5" /> Add First Exercise
									</Button>
								</Empty.Content>
							{/if}
						</Empty.Root>
					</div>
				{:else}
					<!-- Exercises Grid/List -->
					<div class="space-y-4">
						{#each exercises as exercise, index (exercise._id)}
							{@const isActive =
								session.status === 'active' && index === session.currentExerciseIndex}
							<Card.Root
								class="relative overflow-hidden border transition-all duration-200 rounded-xl {isActive
									? 'border-primary shadow-sm bg-primary/5'
									: 'border-border/50 bg-card/40 hover:border-border'}"
							>
								<!-- Left/Side accent indicator for active exercise -->
								{#if isActive}
									<div class="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
								{/if}

								<div class="flex items-start gap-4 p-5">
									<!-- Reorder & Controls Section (If Active Session) -->
									{#if session.status === 'active'}
										<div class="flex flex-col items-center gap-1.5 pt-0.5">
											<Button
												variant="ghost"
												size="icon-xs"
												disabled={index === 0}
												onclick={() => handleMoveExercise(exercise._id, 'up')}
												class="size-6 text-muted-foreground hover:text-foreground rounded-md disabled:opacity-20"
												title="Move Up"
											>
												<ArrowUp class="size-3.5" />
											</Button>
											<span
												class="text-[10px] font-mono font-bold text-muted-foreground leading-none"
											>
												{index + 1}
											</span>
											<Button
												variant="ghost"
												size="icon-xs"
												disabled={index === exercises.length - 1}
												onclick={() => handleMoveExercise(exercise._id, 'down')}
												class="size-6 text-muted-foreground hover:text-foreground rounded-md disabled:opacity-20"
												title="Move Down"
											>
												<ArrowDown class="size-3.5" />
											</Button>
										</div>
									{:else}
										<div
											class="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground font-mono text-xs font-bold"
										>
											{index + 1}
										</div>
									{/if}

									<!-- Main card content layout -->
									<div class="flex-1 min-w-0">
										<div class="flex items-start justify-between gap-4">
											<div>
												<Card.Title class="text-base font-bold tracking-tight">
													{exercise.name}
												</Card.Title>
											</div>

											<!-- Edit/Delete Action Controls (If Active Session) -->
											{#if session.status === 'active'}
												<div class="flex items-center gap-1">
													<Button
														variant="ghost"
														size="icon-sm"
														onclick={() => openEditExercise(exercise)}
														class="hover:bg-primary/10 hover:text-primary rounded-full transition-colors size-7"
														title="Edit"
													>
														<Edit3 class="size-3.5" />
													</Button>
													<Button
														variant="ghost"
														size="icon-sm"
														onclick={() => handleDeleteExercise(exercise._id)}
														class="hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-full transition-colors size-7"
														title="Delete"
													>
														<Trash2 class="size-3.5" />
													</Button>
												</div>
											{/if}
										</div>

										<!-- Description Content (Card.Content) -->
										{#if exercise.description}
											<Card.Content class="p-0 mt-2 text-xs text-muted-foreground leading-relaxed">
												{exercise.description}
											</Card.Content>
										{/if}

										<!-- Rest & Sets (Card.Footer) -->
										<Card.Footer
											class="p-0 mt-4 pt-3 border-t border-border/20 flex gap-4 text-xs text-muted-foreground"
										>
											<div class="flex items-center gap-1.5">
												<ListPlus class="size-3.5 text-primary/60" />
												<span>{exercise.setsCount} Target Sets</span>
											</div>
											<div class="flex items-center gap-1.5">
												<Clock class="size-3.5 text-primary/60" />
												<span>{exercise.restTime}s Rest</span>
											</div>
										</Card.Footer>
									</div>
								</div>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Live Workout Tracker & Timer Section -->
			<div>
				{#if exercises.length === 0}
					<Card.Root class="border-dashed border-border/60 bg-muted/10 text-center p-8">
						<Card.Content class="space-y-4">
							<Dumbbell class="size-10 text-muted-foreground mx-auto opacity-40 animate-pulse" />
							<div class="space-y-1">
								<h3 class="font-bold text-sm">Tracker Locked</h3>
								<p class="text-xs text-muted-foreground">
									Add exercises to activate the tracker and starting logging sets.
								</p>
							</div>
						</Card.Content>
					</Card.Root>
				{:else}
					{@const currentExercise = exercises[session.currentExerciseIndex]}
					{@const isWorkoutComplete =
						currentExercise && session.currentSet > currentExercise.setsCount}

					<Card.Root
						class="overflow-hidden border border-border/80 bg-card/80 backdrop-blur-xs shadow-md rounded-xl"
					>
						<Card.Header class="pb-3 border-b border-border/30">
							<div class="flex items-center justify-between">
								<h3 class="text-sm font-bold tracking-tight text-muted-foreground">
									{session.status === 'active' ? 'Workout Progress' : 'Summary'}
								</h3>
								<Dumbbell class="size-4.5 text-primary" />
							</div>
						</Card.Header>

						<Card.Content class="p-6">
							{#if session.status === 'completed'}
								<!-- Summary State for completed sessions -->
								<div class="text-center py-6 space-y-4">
									<div
										class="size-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto ring-4 ring-emerald-500/5"
									>
										<Award class="size-8 animate-bounce" />
									</div>
									<div class="space-y-1">
										<h4 class="text-lg font-bold tracking-tight">Workout Completed!</h4>
										<p class="text-xs text-muted-foreground">
											Congratulations! You logged all exercises in this session.
										</p>
									</div>

									<div class="flex flex-col items-center gap-2 mt-4">
										<div
											class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
										>
											Finished Ago
										</div>
										<div class="text-3xl font-bold font-mono tracking-tight text-primary">
											{formatTime(timeSinceFinished)}
										</div>
										<Button
											variant="outline"
											size="sm"
											onclick={handleResumeSession}
											class="rounded-full shadow-sm hover:shadow-md transition-all mt-2"
										>
											<Play class="mr-2 size-4" /> Resume Session
										</Button>
									</div>

									<div class="grid grid-cols-2 gap-4 pt-6 border-t border-border/30 mt-4">
										<div class="p-3 bg-muted/30 rounded-lg">
											<div class="text-xl font-bold font-mono">{exercises.length}</div>
											<div
												class="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold"
											>
												Exercises
											</div>
										</div>
										<div class="p-3 bg-muted/30 rounded-lg">
											<div class="text-xl font-bold font-mono">
												{exercises.reduce((sum, e) => sum + e.setsCount, 0)}
											</div>
											<div
												class="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold"
											>
												Total Sets
											</div>
										</div>
									</div>
								</div>
							{:else if isWorkoutComplete}
								<!-- All Exercises Logged Complete state -->
								<div class="text-center py-6 space-y-4">
									<div
										class="size-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto"
									>
										<Check class="size-8" />
									</div>
									<div class="space-y-1">
										<h4 class="text-base font-bold">All Exercises Finished!</h4>
										<p class="text-xs text-muted-foreground max-w-xs mx-auto">
											You have finished logging all targets. Tap the Finish Workout button to save
											this session.
										</p>
									</div>

									<div class="flex gap-2 justify-center pt-2">
										<Button variant="outline" size="sm" onclick={handleGoBack} class="rounded-full">
											Go Back
										</Button>
										<Button
											variant="default"
											size="sm"
											onclick={handleFinishSession}
											class="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold"
										>
											Finish Workout
										</Button>
									</div>
								</div>
							{:else}
								<!-- Active Session Tracking Mode -->
								<div class="space-y-6">
									<!-- Tracker Exercise Details -->
									<div class="space-y-1">
										<div class="text-[10px] uppercase font-bold tracking-wider text-primary">
											Exercise {session.currentExerciseIndex + 1} of {exercises.length}
										</div>
										<h4 class="text-lg font-bold tracking-tight leading-tight">
											{currentExercise.name}
										</h4>
										{#if currentExercise.description}
											<p class="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
												{currentExercise.description}
											</p>
										{/if}
									</div>

									<!-- Progression State indicator -->
									{#if remainingTime > 0}
										<!-- Rest countdown Active state -->
										<div
											class="space-y-4 py-2 text-center bg-muted/20 border border-border/40 rounded-2xl p-4"
										>
											<div class="space-y-1">
												<div
													class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
												>
													Rest Period
												</div>
												<div class="text-4xl font-extrabold font-mono tracking-tight text-primary">
													{remainingTime}s
												</div>
											</div>

											<!-- Progress indicator bar -->
											<div class="h-2 w-full bg-secondary rounded-full overflow-hidden">
												<div
													class="h-full bg-primary transition-all duration-1000 ease-linear"
													style="width: {progressPercentage}%"
												></div>
											</div>

											<!-- Timer adjustments -->
											<div class="flex items-center justify-center gap-2 pt-1">
												<Button
													variant="outline"
													size="xs"
													onclick={() => handleAddRestTime(30)}
													class="rounded-full text-[10px] h-7 px-3"
												>
													+30s
												</Button>
												<Button
													variant="ghost"
													size="xs"
													onclick={handleSkipRest}
													class="rounded-full text-[10px] h-7 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
												>
													Skip Rest
												</Button>
											</div>
										</div>
									{:else}
										<!-- Active logging mode -->
										<div
											class="py-6 text-center border border-border/40 bg-card rounded-2xl space-y-2"
										>
											<div
												class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
											>
												Active Set
											</div>
											<div class="text-5xl font-extrabold tracking-tight font-mono text-foreground">
												{session.currentSet}
												<span class="text-lg font-medium text-muted-foreground font-sans">
													/ {currentExercise.setsCount}
												</span>
											</div>
										</div>
									{/if}

									<!-- Interactive Progression Buttons -->
									<div class="flex flex-col gap-2 pt-2">
										{#if remainingTime === 0}
											<Button
												variant="default"
												size="lg"
												onclick={handleLogSet}
												class="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md transition-all h-12"
											>
												<Check class="mr-2 size-5" /> Log Set {session.currentSet} Done
											</Button>
										{/if}

										<div class="grid grid-cols-2 gap-2">
											<Button
												variant="outline"
												size="sm"
												disabled={session.currentExerciseIndex === 0 && session.currentSet === 1}
												onclick={handleGoBack}
												class="rounded-full text-xs font-semibold h-10 disabled:opacity-30"
											>
												Go Back
											</Button>
											{#if remainingTime > 0}
												<Button
													variant="default"
													size="sm"
													onclick={handleSkipRest}
													class="rounded-full text-xs font-semibold h-10"
												>
													Start Next Set
												</Button>
											{:else}
												<Button
													variant="secondary"
													size="sm"
													onclick={handleLogSet}
													class="rounded-full text-xs font-semibold h-10"
												>
													Skip Set
												</Button>
											{/if}
										</div>
									</div>
								</div>
							{/if}
						</Card.Content>
					</Card.Root>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Exercise Adding & Editing Dialog -->
<Dialog.Root bind:open={isExerciseDialogOpen}>
	<Dialog.Content class="sm:max-w-md bg-card border border-border/80 shadow-lg">
		<Dialog.Header>
			<Dialog.Title class="text-lg font-bold">
				{editingExercise ? 'Edit Exercise' : 'Add Exercise to Session'}
			</Dialog.Title>
			<Dialog.Description class="text-xs text-muted-foreground">
				Provide target sets, rest interval, and optional description notes.
			</Dialog.Description>
		</Dialog.Header>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSaveExercise();
			}}
			class="space-y-4 py-4"
		>
			<!-- Exercise Name -->
			<div class="space-y-1.5">
				<Label for="exercise-name">Exercise Name</Label>
				<Input
					id="exercise-name"
					type="text"
					bind:value={exerciseName}
					placeholder="e.g. Incline DB Fly, Overhead Press"
					aria-invalid={triedExerciseSubmit && exerciseNameError !== ''}
				/>
				{#if triedExerciseSubmit && exerciseNameError}
					<span class="text-[10px] text-destructive leading-none block mt-1">
						{exerciseNameError}
					</span>
				{/if}
			</div>

			<!-- Optional Description (Textarea Component) -->
			<div class="space-y-1.5">
				<Label for="exercise-description">Description / Notes (Optional)</Label>
				<Textarea
					id="exercise-description"
					bind:value={exerciseDescription}
					placeholder="Enter form cues, seat heights, or specific targets..."
					class="min-h-[80px]"
				/>
			</div>

			<!-- Target Sets & Rest Time Row -->
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<Label for="exercise-sets">Target Sets</Label>
					<Input
						id="exercise-sets"
						type="number"
						min="1"
						bind:value={exerciseSets}
						aria-invalid={triedExerciseSubmit && exerciseSetsError !== ''}
					/>
					{#if triedExerciseSubmit && exerciseSetsError}
						<span class="text-[10px] text-destructive leading-none block mt-1">
							{exerciseSetsError}
						</span>
					{/if}
				</div>

				<div class="space-y-1.5">
					<Label for="exercise-rest">Rest (Seconds)</Label>
					<Input
						id="exercise-rest"
						type="number"
						min="5"
						step="5"
						bind:value={exerciseRest}
						aria-invalid={triedExerciseSubmit && exerciseRestError !== ''}
					/>
					{#if triedExerciseSubmit && exerciseRestError}
						<span class="text-[10px] text-destructive leading-none block mt-1">
							{exerciseRestError}
						</span>
					{/if}
				</div>
			</div>

			<!-- Footer Action Buttons -->
			<Dialog.Footer class="pt-4 flex gap-2 justify-end">
				<Dialog.Close>
					<Button type="button" variant="outline" class="rounded-full">Cancel</Button>
				</Dialog.Close>
				<Button type="submit" class="rounded-full shadow-xs">
					{editingExercise ? 'Save Changes' : 'Add Exercise'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Finish Session Confirmation Alert Dialog -->
<AlertDialog.Root bind:open={isFinishDialogOpen}>
	<AlertDialog.Content class="bg-card border border-border/80 shadow-lg sm:max-w-md">
		<AlertDialog.Header>
			<AlertDialog.Title class="text-lg font-bold">Finish Workout Session?</AlertDialog.Title>
			<AlertDialog.Description class="text-xs text-muted-foreground">
				Are you sure you want to finish this workout session? Your stats will be saved to your
				dashboard. You can resume this session later if needed.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer class="flex gap-2 justify-end pt-4">
			<AlertDialog.Cancel class="rounded-full">Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={confirmFinishSession}
				class="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
			>
				Finish Workout
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
