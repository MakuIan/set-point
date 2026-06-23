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
	const updateSessionMutation = useMutation(api.sessions.update);

	// Dialog & Form State
	let isExerciseDialogOpen = $state(false);
	let editingExercise = $state<SessionExercise | null>(null);

	// Phase Timer Dialog & State
	let isPhaseTimerDialogOpen = $state(false);
	let phaseTimerType = $state<'warmup' | 'cooldown'>('warmup');
	let phaseTimerDurationMinutes = $state(5);

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
		console.log('Finished timer effect ran. sessionData:', sessionData);
		if (sessionData && sessionData.status === 'completed' && sessionData.timerEndTime) {
			console.log('Conditions met. Starting timer. timerEndTime:', sessionData.timerEndTime);
			const updateTimer = () => {
				timeSinceFinished = Math.max(
					0,
					Math.floor((Date.now() - sessionData.timerEndTime!) / 1000)
				);
				console.log('Timer updated: timeSinceFinished =', timeSinceFinished);
			};
			updateTimer();
			finishedTimerInterval = setInterval(updateTimer, 1000);
		} else {
			console.log('Conditions not met. Clearing timer.');
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
		if (sessionData && sessionData.status === 'active') {
			if (
				sessionData.isPaused &&
				sessionData.pausedRemainingTime !== undefined &&
				sessionData.pausedRemainingTime !== null
			) {
				remainingTime = sessionData.pausedRemainingTime;
				if (timerInterval) {
					clearInterval(timerInterval);
					timerInterval = null;
				}
			} else if (sessionData.timerEndTime) {
				const updateTimer = () => {
					const diff = Math.ceil((sessionData.timerEndTime! - Date.now()) / 1000);
					remainingTime = Math.max(0, diff);
					if (diff <= 0 && timerInterval) {
						clearInterval(timerInterval);
						timerInterval = null;
					}
				};
				updateTimer();
				if (!timerInterval) {
					timerInterval = setInterval(updateTimer, 1000);
				}
			} else {
				remainingTime = 0;
				if (timerInterval) {
					clearInterval(timerInterval);
					timerInterval = null;
				}
			}
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
				// Finished all sets for all exercises!
				if (
					session.cooldownDuration !== null &&
					session.cooldownDuration !== undefined &&
					session.cooldownDuration > 0
				) {
					await updatePlayerStateMutation({
						sessionId: session._id,
						currentExerciseIndex: nextExerciseIndex,
						currentSet: currentExercise.setsCount + 1,
						timerEndTime: Date.now() + session.cooldownDuration * 1000,
						timerDuration: session.cooldownDuration,
						currentPhase: 'cooldown'
					});
					return;
				} else {
					// Mark as fully done
					nextSet = currentExercise.setsCount + 1;
				}
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

	async function handleTogglePauseTimer() {
		if (!sessionQuery?.data) return;
		const session = sessionQuery.data;

		if (session.isPaused) {
			const remaining = session.pausedRemainingTime ?? 0;
			const newEndTime = Date.now() + remaining * 1000;

			await updatePlayerStateMutation({
				sessionId,
				currentExerciseIndex: session.currentExerciseIndex,
				currentSet: session.currentSet,
				timerEndTime: newEndTime,
				timerDuration: session.timerDuration,
				isPaused: false,
				pausedRemainingTime: null,
				currentPhase: session.currentPhase
			});
		} else {
			const remaining = remainingTime;

			await updatePlayerStateMutation({
				sessionId,
				currentExerciseIndex: session.currentExerciseIndex,
				currentSet: session.currentSet,
				timerEndTime: null,
				timerDuration: session.timerDuration,
				isPaused: true,
				pausedRemainingTime: remaining,
				currentPhase: session.currentPhase
			});
		}
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
		} else if (
			session.warmupDuration !== null &&
			session.warmupDuration !== undefined &&
			session.warmupDuration > 0
		) {
			// Transition back to warmup phase
			await updatePlayerStateMutation({
				sessionId: session._id,
				currentExerciseIndex: 0,
				currentSet: 1,
				timerEndTime: null,
				timerDuration: session.warmupDuration,
				currentPhase: 'warmup'
			});
			return;
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

	// Warm-up & Cool-down Phase Timer Helper Functions
	const currentPhase = $derived(sessionQuery?.data?.currentPhase ?? 'exercises');

	function openAddPhaseTimer(type: 'warmup' | 'cooldown') {
		phaseTimerType = type;
		phaseTimerDurationMinutes = 5;
		isPhaseTimerDialogOpen = true;
	}

	function openEditPhaseTimer(type: 'warmup' | 'cooldown', currentDurationSeconds: number) {
		phaseTimerType = type;
		phaseTimerDurationMinutes = Math.round(currentDurationSeconds / 60);
		isPhaseTimerDialogOpen = true;
	}

	async function handleSavePhaseTimer() {
		if (!sessionQuery?.data) return;
		const session = sessionQuery.data;
		const durationSeconds = phaseTimerDurationMinutes * 60;
		const isWarmup = phaseTimerType === 'warmup';

		try {
			await updateSessionMutation({
				sessionId: session._id,
				name: session.name,
				defaultSetsCount: session.defaultSetsCount,
				defaultRestTime: session.defaultRestTime,
				warmupDuration: isWarmup ? durationSeconds : (session.warmupDuration ?? null),
				cooldownDuration: !isWarmup ? durationSeconds : (session.cooldownDuration ?? null)
			});

			if (session.currentPhase === phaseTimerType) {
				await updatePlayerStateMutation({
					sessionId: session._id,
					currentExerciseIndex: session.currentExerciseIndex,
					currentSet: session.currentSet,
					timerEndTime: Date.now() + durationSeconds * 1000,
					timerDuration: durationSeconds
				});
			}
			isPhaseTimerDialogOpen = false;
		} catch (err) {
			console.error(err);
			alert('Failed to update timer.');
		}
	}

	async function handleDeletePhaseTimer(type: 'warmup' | 'cooldown') {
		if (!sessionQuery?.data) return;
		const session = sessionQuery.data;
		const isWarmup = type === 'warmup';

		if (
			!confirm(
				`Are you sure you want to remove the ${type === 'warmup' ? 'Warm-up' : 'Cool-down'}?`
			)
		)
			return;

		try {
			await updateSessionMutation({
				sessionId: session._id,
				name: session.name,
				defaultSetsCount: session.defaultSetsCount,
				defaultRestTime: session.defaultRestTime,
				warmupDuration: isWarmup ? null : (session.warmupDuration ?? null),
				cooldownDuration: !isWarmup ? null : (session.cooldownDuration ?? null)
			});

			if (session.currentPhase === type) {
				if (isWarmup) {
					await updatePlayerStateMutation({
						sessionId: session._id,
						currentExerciseIndex: 0,
						currentSet: 1,
						timerEndTime: null,
						timerDuration: session.defaultRestTime,
						currentPhase: 'exercises'
					});
				} else {
					await finishSessionMutation({ sessionId: session._id });
				}
			}
		} catch (err) {
			console.error(err);
			alert('Failed to remove timer.');
		}
	}

	async function handleStartWarmup() {
		if (!sessionQuery?.data) return;
		await updatePlayerStateMutation({
			sessionId,
			currentExerciseIndex: sessionQuery.data.currentExerciseIndex,
			currentSet: sessionQuery.data.currentSet,
			timerEndTime: Date.now() + sessionQuery.data.timerDuration * 1000,
			timerDuration: sessionQuery.data.timerDuration,
			currentPhase: 'warmup'
		});
	}

	async function handleStartWorkoutFromWarmup() {
		if (!sessionQuery?.data) return;
		await updatePlayerStateMutation({
			sessionId,
			currentExerciseIndex: 0,
			currentSet: 1,
			timerEndTime: null,
			timerDuration: sessionQuery.data.defaultRestTime,
			currentPhase: 'exercises'
		});
	}

	async function handleSkipWarmup() {
		if (!sessionQuery?.data) return;
		await updatePlayerStateMutation({
			sessionId,
			currentExerciseIndex: 0,
			currentSet: 1,
			timerEndTime: null,
			timerDuration: sessionQuery.data.defaultRestTime,
			currentPhase: 'exercises'
		});
	}

	async function handleSkipCooldown() {
		if (!sessionQuery?.data) return;
		await updatePlayerStateMutation({
			sessionId,
			currentExerciseIndex: sessionQuery.data.currentExerciseIndex,
			currentSet: sessionQuery.data.currentSet,
			timerEndTime: null,
			timerDuration: sessionQuery.data.timerDuration
		});
	}

	async function handleGoBackFromCooldown() {
		if (!sessionQuery?.data) return;
		const session = sessionQuery.data;
		const exercises = session.exercises;
		if (exercises.length === 0) return;

		const lastExerciseIndex = exercises.length - 1;
		const lastExercise = exercises[lastExerciseIndex];

		await updatePlayerStateMutation({
			sessionId: session._id,
			currentExerciseIndex: lastExerciseIndex,
			currentSet: lastExercise.setsCount,
			timerEndTime: null,
			timerDuration: lastExercise.restTime,
			currentPhase: 'exercises'
		});
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

			{#if sessionQuery.data}
				{#if sessionQuery.data.status === 'active'}
					<Button
						variant="default"
						size="lg"
						onclick={handleFinishSession}
						class="rounded-full shadow-md hover:shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all"
					>
						<Check class="mr-2 size-5" /> Finish Workout
					</Button>
				{:else if sessionQuery.data.status === 'completed'}
					<div class="flex items-center gap-3">
						<span class="text-sm font-semibold text-muted-foreground">
							Finished {formatTime(timeSinceFinished)} ago
						</span>
						<Button
							variant="outline"
							size="sm"
							onclick={handleResumeSession}
							class="rounded-full border-primary/20 hover:bg-primary/5 hover:text-primary transition-all font-bold"
						>
							<Play class="mr-1.5 size-4" /> Resume Session
						</Button>
					</div>
				{/if}
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
					<Button
						variant="outline"
						size="sm"
						onclick={openAddExercise}
						class="rounded-full border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
					>
						<Plus class="mr-1.5 size-4" /> Add Exercise
					</Button>
				</div>

				<!-- Warm-up Card or Add Button -->
				{#if session.warmupDuration !== null && session.warmupDuration !== undefined && session.warmupDuration > 0}
					{@const isWarmupActive = session.status === 'active' && currentPhase === 'warmup'}
					<Card.Root
						class="relative overflow-hidden border transition-all duration-200 rounded-xl {isWarmupActive
							? 'border-orange-500 shadow-sm bg-orange-500/5'
							: 'border-border/50 bg-card/40 hover:border-border'}"
					>
						{#if isWarmupActive}
							<div class="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
						{/if}
						<div class="flex items-start gap-4 p-5">
							<div
								class="flex size-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-xs"
							>
								WU
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-start justify-between gap-4">
									<div>
										<Card.Title class="text-base font-bold tracking-tight flex items-center gap-2">
											Warm-up
											<span
												class="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-600 ring-1 ring-orange-500/20 dark:text-orange-400 uppercase tracking-wider"
											>
												Warm-up
											</span>
										</Card.Title>
										<p class="text-xs text-muted-foreground mt-1">
											Prepare your body for the workout.
										</p>
									</div>
									{#if session.status === 'active'}
										<div class="flex items-center gap-1">
											<Button
												variant="ghost"
												size="icon-sm"
												onclick={() => openEditPhaseTimer('warmup', session.warmupDuration ?? 0)}
												class="hover:bg-primary/10 hover:text-primary rounded-full transition-colors size-7"
												title="Edit Warm-up"
											>
												<Edit3 class="size-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="icon-sm"
												onclick={() => handleDeletePhaseTimer('warmup')}
												class="hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-full transition-colors size-7"
												title="Delete Warm-up"
											>
												<Trash2 class="size-3.5" />
											</Button>
										</div>
									{/if}
								</div>
								<Card.Footer
									class="p-0 mt-4 pt-3 border-t border-border/20 flex gap-4 text-xs text-muted-foreground"
								>
									<div class="flex items-center gap-1.5">
										<Clock class="size-3.5 text-orange-500/60" />
										<span>{Math.round(session.warmupDuration / 60)} Minutes Duration</span>
									</div>
								</Card.Footer>
							</div>
						</div>
					</Card.Root>
				{:else if session.status === 'active'}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => openAddPhaseTimer('warmup')}
						class="w-full justify-start rounded-xl border border-dashed border-border/60 py-3 text-xs text-muted-foreground hover:text-orange-500 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all gap-1.5"
					>
						<Plus class="size-4" /> Add Warm-up Timer
					</Button>
				{/if}

				<!-- Exercises List Section -->
				{#if exercises.length === 0}
					<div
						class="flex flex-col items-center justify-center p-8 border border-dashed border-border/60 rounded-2xl bg-muted/10 backdrop-blur-xs min-h-[200px] text-center w-full"
					>
						<Empty.Root>
							<Empty.Header>
								<Empty.Media
									variant="icon"
									class="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 mx-auto"
								>
									<ListPlus class="size-6" />
								</Empty.Media>
								<Empty.Title class="text-lg font-bold">No Exercises Added</Empty.Title>
								<Empty.Description class="text-xs text-muted-foreground max-w-sm mt-1">
									Add exercises to this workout session to start tracking your sets and rest times.
								</Empty.Description>
							</Empty.Header>
							<Empty.Content class="mt-4">
								<Button
									onclick={openAddExercise}
									size="sm"
									class="rounded-full shadow-sm hover:shadow-md transition-all"
								>
									<Plus class="mr-1.5 size-4" /> Add First Exercise
								</Button>
							</Empty.Content>
						</Empty.Root>
					</div>
				{:else}
					<!-- Exercises Grid/List -->
					<div class="space-y-4">
						{#each exercises as exercise, index (exercise._id)}
							{@const isActive =
								session.status === 'active' &&
								currentPhase === 'exercises' &&
								index === session.currentExerciseIndex}
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
												<Card.Title
													class="text-base font-bold tracking-tight flex items-center gap-2"
												>
													{exercise.name}
													<span
														class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/20 uppercase tracking-wider"
													>
														Exercise
													</span>
												</Card.Title>
											</div>

											<!-- Edit/Delete Action Controls -->
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

				<!-- Cool-down Card or Add Button -->
				{#if session.cooldownDuration !== null && session.cooldownDuration !== undefined && session.cooldownDuration > 0}
					{@const isCooldownActive = session.status === 'active' && currentPhase === 'cooldown'}
					<Card.Root
						class="relative overflow-hidden border transition-all duration-200 rounded-xl {isCooldownActive
							? 'border-cyan-500 shadow-sm bg-cyan-500/5'
							: 'border-border/50 bg-card/40 hover:border-border'}"
					>
						{#if isCooldownActive}
							<div class="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500"></div>
						{/if}
						<div class="flex items-start gap-4 p-5">
							<div
								class="flex size-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-xs"
							>
								CD
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-start justify-between gap-4">
									<div>
										<Card.Title class="text-base font-bold tracking-tight flex items-center gap-2">
											Cool-down
											<span
												class="inline-flex items-center rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-600 ring-1 ring-cyan-500/20 dark:text-cyan-400 uppercase tracking-wider"
											>
												Cool-down
											</span>
										</Card.Title>
										<p class="text-xs text-muted-foreground mt-1">
											Recover and stretch after your exercises.
										</p>
									</div>
									{#if session.status === 'active'}
										<div class="flex items-center gap-1">
											<Button
												variant="ghost"
												size="icon-sm"
												onclick={() =>
													openEditPhaseTimer('cooldown', session.cooldownDuration ?? 0)}
												class="hover:bg-primary/10 hover:text-primary rounded-full transition-colors size-7"
												title="Edit Cool-down"
											>
												<Edit3 class="size-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="icon-sm"
												onclick={() => handleDeletePhaseTimer('cooldown')}
												class="hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-full transition-colors size-7"
												title="Delete Cool-down"
											>
												<Trash2 class="size-3.5" />
											</Button>
										</div>
									{/if}
								</div>
								<Card.Footer
									class="p-0 mt-4 pt-3 border-t border-border/20 flex gap-4 text-xs text-muted-foreground"
								>
									<div class="flex items-center gap-1.5">
										<Clock class="size-3.5 text-cyan-500/60" />
										<span>{Math.round(session.cooldownDuration / 60)} Minutes Duration</span>
									</div>
								</Card.Footer>
							</div>
						</div>
					</Card.Root>
				{:else if session.status === 'active'}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => openAddPhaseTimer('cooldown')}
						class="w-full justify-start rounded-xl border border-dashed border-border/60 py-3 text-xs text-muted-foreground hover:text-cyan-500 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all gap-1.5"
					>
						<Plus class="size-4" /> Add Cool-down Timer
					</Button>
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
							{:else if currentPhase === 'warmup'}
								<!-- Warm-up Player -->
								<div class="space-y-6">
									<div class="space-y-1">
										<div
											class="text-[10px] uppercase font-bold tracking-wider text-orange-600 dark:text-orange-400"
										>
											Warm-up Phase
										</div>
										<h4 class="text-lg font-bold tracking-tight leading-tight">
											Prepare Your Body
										</h4>
										<p class="text-xs text-muted-foreground mt-1 leading-relaxed">
											Increase body temperature and prepare your muscles.
										</p>
									</div>

									{#if remainingTime > 0}
										<div
											class="space-y-4 py-2 text-center bg-muted/20 border border-border/40 rounded-2xl p-4"
										>
											<div class="space-y-1">
												<div
													class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
												>
													Warm-up Timer
												</div>
												<div class="text-4xl font-extrabold font-mono tracking-tight text-primary">
													{remainingTime}s
												</div>
											</div>

											<!-- Progress indicator bar -->
											<div class="h-2 w-full bg-secondary rounded-full overflow-hidden">
												<div
													class="h-full bg-orange-500 transition-all duration-1000 ease-linear"
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
													variant="outline"
													size="xs"
													onclick={handleTogglePauseTimer}
													class="rounded-full text-[10px] h-7 px-3 flex items-center gap-1"
												>
													{#if session.isPaused}
														<Play class="size-3 text-emerald-500 fill-emerald-500" /> Resume
													{:else}
														<Square class="size-3 text-amber-500 fill-amber-500" /> Pause
													{/if}
												</Button>
												<Button
													variant="ghost"
													size="xs"
													onclick={handleSkipWarmup}
													class="rounded-full text-[10px] h-7 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
												>
													Skip Warm-up
												</Button>
											</div>
										</div>
									{:else if session.timerEndTime === null && !session.isPaused}
										<!-- Warm-up not started yet -->
										<div
											class="space-y-4 py-2 text-center bg-muted/20 border border-border/40 rounded-2xl p-4"
										>
											<div class="space-y-1">
												<div
													class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
												>
													Warm-up Duration
												</div>
												<div class="text-4xl font-extrabold font-mono tracking-tight text-primary">
													{session.timerDuration}s
												</div>
											</div>

											<!-- Progress indicator bar (100% full) -->
											<div class="h-2 w-full bg-secondary rounded-full overflow-hidden">
												<div class="h-full bg-orange-500" style="width: 100%"></div>
											</div>

											<div class="flex flex-col gap-2 pt-2">
												<Button
													variant="default"
													size="lg"
													onclick={handleStartWarmup}
													class="w-full rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md transition-all h-12"
												>
													<Play class="mr-2 size-5 fill-white" /> Start Warm-up
												</Button>
												<Button
													variant="ghost"
													size="xs"
													onclick={handleSkipWarmup}
													class="rounded-full text-[10px] h-7 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
												>
													Skip Warm-up
												</Button>
											</div>
										</div>
									{:else}
										<!-- Warm-up finished -->
										<div class="space-y-4 w-full">
											<div
												class="py-6 text-center border border-border/40 bg-card rounded-2xl space-y-2"
											>
												<div
													class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
												>
													Warm-up Finished
												</div>
												<div class="text-lg font-extrabold text-foreground">Ready to Start!</div>
											</div>

											<div class="flex flex-col gap-2 pt-2">
												<Button
													variant="default"
													size="lg"
													onclick={handleStartWorkoutFromWarmup}
													class="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md transition-all h-12"
												>
													<Play class="mr-2 size-5" /> Start First Exercise
												</Button>
											</div>
										</div>
									{/if}
								</div>
							{:else if currentPhase === 'cooldown'}
								<!-- Cool-down Player -->
								<div class="space-y-6">
									<div class="space-y-1">
										<div
											class="text-[10px] uppercase font-bold tracking-wider text-cyan-600 dark:text-cyan-400"
										>
											Cool-down Phase
										</div>
										<h4 class="text-lg font-bold tracking-tight leading-tight">
											Relax and Recover
										</h4>
										<p class="text-xs text-muted-foreground mt-1 leading-relaxed">
											Slow down your heart rate and stretch.
										</p>
									</div>

									{#if remainingTime > 0}
										<div
											class="space-y-4 py-2 text-center bg-muted/20 border border-border/40 rounded-2xl p-4"
										>
											<div class="space-y-1">
												<div
													class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
												>
													Cool-down Timer
												</div>
												<div class="text-4xl font-extrabold font-mono tracking-tight text-primary">
													{remainingTime}s
												</div>
											</div>

											<!-- Progress indicator bar -->
											<div class="h-2 w-full bg-secondary rounded-full overflow-hidden">
												<div
													class="h-full bg-cyan-500 transition-all duration-1000 ease-linear"
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
													variant="outline"
													size="xs"
													onclick={handleTogglePauseTimer}
													class="rounded-full text-[10px] h-7 px-3 flex items-center gap-1"
												>
													{#if session.isPaused}
														<Play class="size-3 text-emerald-500 fill-emerald-500" /> Resume
													{:else}
														<Square class="size-3 text-amber-500 fill-amber-500" /> Pause
													{/if}
												</Button>
												<Button
													variant="ghost"
													size="xs"
													onclick={handleSkipCooldown}
													class="rounded-full text-[10px] h-7 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
												>
													Skip Cool-down
												</Button>
											</div>
										</div>
									{:else}
										<div
											class="py-6 text-center border border-border/40 bg-card rounded-2xl space-y-2"
										>
											<div
												class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
											>
												Cool-down Finished
											</div>
											<div class="text-lg font-extrabold text-foreground">Ready to Complete!</div>
										</div>
									{/if}

									<div class="flex flex-col gap-2 pt-2">
										<Button
											variant="default"
											size="lg"
											onclick={confirmFinishSession}
											class="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all h-12"
										>
											<Check class="mr-2 size-5" /> Finish Workout
										</Button>
										<Button
											variant="outline"
											size="sm"
											onclick={handleGoBackFromCooldown}
											class="rounded-full text-xs font-semibold h-10 animate-fade-in"
										>
											Go Back to Exercises
										</Button>
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
													variant="outline"
													size="xs"
													onclick={handleTogglePauseTimer}
													class="rounded-full text-[10px] h-7 px-3 flex items-center gap-1"
												>
													{#if session.isPaused}
														<Play class="size-3 text-emerald-500 fill-emerald-500" /> Resume
													{:else}
														<Square class="size-3 text-amber-500 fill-amber-500" /> Pause
													{/if}
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
												disabled={session.currentExerciseIndex === 0 &&
													session.currentSet === 1 &&
													!(session.warmupDuration && session.warmupDuration > 0)}
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

<!-- Warm-up / Cool-down Phase Timer Edit/Add Dialog -->
<Dialog.Root bind:open={isPhaseTimerDialogOpen}>
	<Dialog.Content class="sm:max-w-md bg-card border border-border/80 shadow-lg">
		<Dialog.Header>
			<Dialog.Title class="text-lg font-bold">
				{phaseTimerType === 'warmup' ? 'Edit Warm-up Duration' : 'Edit Cool-down Duration'}
			</Dialog.Title>
			<Dialog.Description class="text-xs text-muted-foreground">
				Set the duration for this phase in minutes.
			</Dialog.Description>
		</Dialog.Header>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSavePhaseTimer();
			}}
			class="space-y-4 py-4"
		>
			<div class="space-y-1.5">
				<Label for="phase-timer-duration">Duration (Minutes)</Label>
				<Input
					id="phase-timer-duration"
					type="number"
					min="1"
					bind:value={phaseTimerDurationMinutes}
				/>
			</div>

			<Dialog.Footer class="pt-4 flex gap-2 justify-end">
				<Dialog.Close>
					<Button type="button" variant="outline" class="rounded-full">Cancel</Button>
				</Dialog.Close>
				<Button type="submit" class="rounded-full shadow-xs">Save Duration</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
