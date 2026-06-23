import { query, mutation } from './_generated/server.js';
import { v } from 'convex/values';
import { authComponent } from './auth.js';

/**
 * Fetch all sessions for the authenticated user with their associated exercises.
 */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx);
		if (!user) {
			return [];
		}

		const sessions = await ctx.db
			.query('workoutSessions')
			.withIndex('by_user_status', (q) => q.eq('userId', user._id))
			.collect();

		const sessionsWithDetails = await Promise.all(
			sessions.map(async (session) => {
				const exercises = await ctx.db
					.query('sessionExercises')
					.withIndex('by_session', (q) => q.eq('sessionId', session._id))
					.collect();

				return {
					...session,
					exercises
				};
			})
		);

		return sessionsWithDetails.sort((a, b) => b.startedAt - a.startedAt);
	}
});

/**
 * Fetch a single workout session by ID with its exercises sorted by order.
 */
export const get = query({
	args: { sessionId: v.id('workoutSessions') },
	handler: async (ctx, args) => {
		const user = await authComponent.safeGetAuthUser(ctx);
		if (!user) {
			return null;
		}

		const session = await ctx.db.get(args.sessionId);
		if (!session || session.userId !== user._id) {
			return null;
		}

		const exercises = await ctx.db
			.query('sessionExercises')
			.withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
			.collect();

		// Sort by order ascending
		exercises.sort((a, b) => a.order - b.order);

		return {
			...session,
			exercises
		};
	}
});

/**
 * Create a new workout session (starts with no exercises).
 */
export const create = mutation({
	args: {
		name: v.string(),
		defaultSetsCount: v.number(),
		defaultRestTime: v.number(),
		warmupDuration: v.optional(v.union(v.number(), v.null())),
		cooldownDuration: v.optional(v.union(v.number(), v.null()))
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		const warmupVal = args.warmupDuration ?? null;
		const cooldownVal = args.cooldownDuration ?? null;
		const hasWarmup = warmupVal !== null && warmupVal > 0;

		const sessionId = await ctx.db.insert('workoutSessions', {
			userId: user._id,
			name: args.name,
			status: 'active',
			startedAt: Date.now(),
			currentExerciseIndex: 0,
			currentSet: 1,
			timerEndTime: null,
			timerDuration: hasWarmup ? warmupVal : args.defaultRestTime,
			defaultSetsCount: args.defaultSetsCount,
			defaultRestTime: args.defaultRestTime,
			warmupDuration: warmupVal,
			cooldownDuration: cooldownVal,
			currentPhase: hasWarmup ? 'warmup' : 'exercises'
		});

		return sessionId;
	}
});

/**
 * Update session-level details (name, defaults).
 */
export const update = mutation({
	args: {
		sessionId: v.id('workoutSessions'),
		name: v.string(),
		defaultSetsCount: v.number(),
		defaultRestTime: v.number(),
		warmupDuration: v.optional(v.union(v.number(), v.null())),
		cooldownDuration: v.optional(v.union(v.number(), v.null()))
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		const session = await ctx.db.get(args.sessionId);
		if (!session || session.userId !== user._id) {
			throw new Error('Unauthorized or session not found');
		}

		const warmupVal =
			args.warmupDuration !== undefined ? args.warmupDuration : (session.warmupDuration ?? null);
		const cooldownVal =
			args.cooldownDuration !== undefined
				? args.cooldownDuration
				: (session.cooldownDuration ?? null);

		const exercises = await ctx.db
			.query('sessionExercises')
			.withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
			.collect();

		if (warmupVal !== null && warmupVal > 0) {
			const totalWarmupExerciseDuration = exercises
				.filter((e) => e.phase === 'warmup')
				.reduce((sum, e) => sum + (e.duration ?? 0), 0);
			if (totalWarmupExerciseDuration > warmupVal) {
				throw new Error(
					`New warmup duration (${warmupVal}s) is less than the total duration of warmup exercises (${totalWarmupExerciseDuration}s).`
				);
			}
		} else {
			const hasWarmupExercises = exercises.some((e) => e.phase === 'warmup');
			if (hasWarmupExercises) {
				throw new Error(
					'Cannot disable warmup because it contains exercises. Please delete the exercises first.'
				);
			}
		}

		if (cooldownVal !== null && cooldownVal > 0) {
			const totalCooldownExerciseDuration = exercises
				.filter((e) => e.phase === 'cooldown')
				.reduce((sum, e) => sum + (e.duration ?? 0), 0);
			if (totalCooldownExerciseDuration > cooldownVal) {
				throw new Error(
					`New cooldown duration (${cooldownVal}s) is less than the total duration of cooldown exercises (${totalCooldownExerciseDuration}s).`
				);
			}
		} else {
			const hasCooldownExercises = exercises.some((e) => e.phase === 'cooldown');
			if (hasCooldownExercises) {
				throw new Error(
					'Cannot disable cooldown because it contains exercises. Please delete the exercises first.'
				);
			}
		}

		await ctx.db.patch(args.sessionId, {
			name: args.name,
			defaultSetsCount: args.defaultSetsCount,
			defaultRestTime: args.defaultRestTime,
			timerDuration: args.defaultRestTime,
			warmupDuration: warmupVal,
			cooldownDuration: cooldownVal
		});
	}
});

/**
 * Delete a session and all its associated exercises and logged sets.
 */
export const deleteSession = mutation({
	args: {
		sessionId: v.id('workoutSessions')
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		const session = await ctx.db.get(args.sessionId);
		if (!session || session.userId !== user._id) {
			throw new Error('Unauthorized or session not found');
		}

		const exercises = await ctx.db
			.query('sessionExercises')
			.withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
			.collect();

		for (const exercise of exercises) {
			await ctx.db.delete(exercise._id);
		}

		const loggedSets = await ctx.db
			.query('loggedSets')
			.withIndex('by_session_exercise', (q) => q.eq('sessionId', args.sessionId))
			.collect();

		for (const set of loggedSets) {
			await ctx.db.delete(set._id);
		}

		await ctx.db.delete(args.sessionId);
	}
});

/**
 * Add a new exercise to a workout session.
 */
export const addExercise = mutation({
	args: {
		sessionId: v.id('workoutSessions'),
		name: v.string(),
		setsCount: v.number(),
		restTime: v.number(),
		description: v.optional(v.string()),
		phase: v.optional(v.string()),
		duration: v.optional(v.number())
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		const session = await ctx.db.get(args.sessionId);
		if (!session || session.userId !== user._id) {
			throw new Error('Unauthorized or session not found');
		}

		const exercises = await ctx.db
			.query('sessionExercises')
			.withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
			.collect();

		if (args.phase === 'warmup' || args.phase === 'cooldown') {
			const limit = args.phase === 'warmup' ? session.warmupDuration : session.cooldownDuration;
			if (limit === undefined || limit === null || limit <= 0) {
				throw new Error(`Please enable the ${args.phase} duration in the session options first.`);
			}
			const totalDuration =
				exercises
					.filter((e) => e.phase === args.phase)
					.reduce((sum, e) => sum + (e.duration ?? 0), 0) + (args.duration ?? 0);
			if (totalDuration > limit) {
				throw new Error(
					`Total duration of exercises in this phase exceeds the configured limit of ${limit}s.`
				);
			}
		}

		const nextOrder = exercises.length > 0 ? Math.max(...exercises.map((e) => e.order)) + 1 : 0;

		const exerciseId = await ctx.db.insert('sessionExercises', {
			sessionId: args.sessionId,
			name: args.name,
			setsCount: args.setsCount,
			restTime: args.restTime,
			description: args.description,
			order: nextOrder,
			phase: args.phase,
			duration: args.duration
		});

		return exerciseId;
	}
});

/**
 * Update details of a specific exercise in a session.
 */
export const updateExercise = mutation({
	args: {
		sessionId: v.id('workoutSessions'),
		exerciseId: v.id('sessionExercises'),
		name: v.string(),
		setsCount: v.number(),
		restTime: v.number(),
		description: v.optional(v.string()),
		phase: v.optional(v.string()),
		duration: v.optional(v.number())
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		const session = await ctx.db.get(args.sessionId);
		if (!session || session.userId !== user._id) {
			throw new Error('Unauthorized or session not found');
		}

		const exercises = await ctx.db
			.query('sessionExercises')
			.withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
			.collect();

		if (args.phase === 'warmup' || args.phase === 'cooldown') {
			const limit = args.phase === 'warmup' ? session.warmupDuration : session.cooldownDuration;
			if (limit === undefined || limit === null || limit <= 0) {
				throw new Error(`Please enable the ${args.phase} duration in the session options first.`);
			}
			const otherDuration = exercises
				.filter((e) => e._id !== args.exerciseId && e.phase === args.phase)
				.reduce((sum, e) => sum + (e.duration ?? 0), 0);
			if (otherDuration + (args.duration ?? 0) > limit) {
				throw new Error(
					`Total duration of exercises in this phase exceeds the configured limit of ${limit}s.`
				);
			}
		}

		await ctx.db.patch(args.exerciseId, {
			name: args.name,
			setsCount: args.setsCount,
			restTime: args.restTime,
			description: args.description,
			phase: args.phase,
			duration: args.duration
		});
	}
});

/**
 * Delete a specific exercise from a session and re-index the orders.
 */
export const deleteExercise = mutation({
	args: {
		sessionId: v.id('workoutSessions'),
		exerciseId: v.id('sessionExercises')
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		const session = await ctx.db.get(args.sessionId);
		if (!session || session.userId !== user._id) {
			throw new Error('Unauthorized or session not found');
		}

		const target = await ctx.db.get(args.exerciseId);
		if (!target || target.sessionId !== args.sessionId) {
			throw new Error('Exercise not found in this session');
		}

		await ctx.db.delete(args.exerciseId);

		const remaining = await ctx.db
			.query('sessionExercises')
			.withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
			.collect();

		remaining.sort((a, b) => a.order - b.order);

		// Re-order exercises sequentially to avoid gaps
		for (let i = 0; i < remaining.length; i++) {
			if (remaining[i].order !== i) {
				await ctx.db.patch(remaining[i]._id, { order: i });
			}
		}

		// Adjust the active index if it now exceeds the number of exercises
		const newCount = remaining.length;
		if (session.currentExerciseIndex >= newCount) {
			await ctx.db.patch(args.sessionId, {
				currentExerciseIndex: Math.max(0, newCount - 1),
				currentSet: 1,
				timerEndTime: null
			});
		}
	}
});

/**
 * Change the order of an exercise by swapping it with an adjacent exercise.
 */
export const moveExercise = mutation({
	args: {
		sessionId: v.id('workoutSessions'),
		exerciseId: v.id('sessionExercises'),
		direction: v.union(v.literal('up'), v.literal('down'))
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		const session = await ctx.db.get(args.sessionId);
		if (!session || session.userId !== user._id) {
			throw new Error('Unauthorized or session not found');
		}

		const exercises = await ctx.db
			.query('sessionExercises')
			.withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
			.collect();

		exercises.sort((a, b) => a.order - b.order);

		const index = exercises.findIndex((e) => e._id === args.exerciseId);
		if (index === -1) {
			throw new Error('Exercise not found in this session');
		}

		if (args.direction === 'up' && index > 0) {
			const current = exercises[index];
			const prev = exercises[index - 1];
			const tempOrder = prev.order;
			await ctx.db.patch(prev._id, { order: current.order });
			await ctx.db.patch(current._id, { order: tempOrder });
		} else if (args.direction === 'down' && index < exercises.length - 1) {
			const current = exercises[index];
			const next = exercises[index + 1];
			const tempOrder = next.order;
			await ctx.db.patch(next._id, { order: current.order });
			await ctx.db.patch(current._id, { order: tempOrder });
		}
	}
});

/**
 * Update the current state of the workout player.
 */
export const updatePlayerState = mutation({
	args: {
		sessionId: v.id('workoutSessions'),
		currentExerciseIndex: v.number(),
		currentSet: v.number(),
		timerEndTime: v.union(v.number(), v.null()),
		timerDuration: v.number(),
		currentPhase: v.optional(v.string()),
		isPaused: v.optional(v.boolean()),
		pausedRemainingTime: v.optional(v.union(v.number(), v.null()))
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		const session = await ctx.db.get(args.sessionId);
		if (!session || session.userId !== user._id) {
			throw new Error('Unauthorized or session not found');
		}

		const patch = {
			currentExerciseIndex: args.currentExerciseIndex,
			currentSet: args.currentSet,
			timerEndTime: args.timerEndTime,
			timerDuration: args.timerDuration,
			isPaused:
				args.isPaused !== undefined
					? args.isPaused
					: args.timerEndTime !== null
						? false
						: undefined,
			pausedRemainingTime:
				args.pausedRemainingTime !== undefined
					? args.pausedRemainingTime
					: args.timerEndTime !== null
						? null
						: undefined,
			...(args.currentPhase !== undefined ? { currentPhase: args.currentPhase } : {})
		};

		await ctx.db.patch(args.sessionId, patch);
	}
});

// Mark the session as finished and record the current timestamp
export const finish = mutation({
	args: { sessionId: v.id('workoutSessions') },
	handler: async (ctx, args) => {
		const now = Date.now();
		await ctx.db.patch(args.sessionId, {
			status: 'completed',
			timerEndTime: now,
			endedAt: now
		});
	}
});

export const resume = mutation({
	args: { sessionId: v.id('workoutSessions') },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) throw new Error('Session not found');

		const warmupVal = session.warmupDuration ?? null;
		const hasWarmup = warmupVal !== null && warmupVal > 0;

		await ctx.db.patch(args.sessionId, {
			status: 'active',
			endedAt: undefined,
			currentExerciseIndex: 0,
			currentSet: 1,
			timerEndTime: null,
			timerDuration: hasWarmup ? warmupVal : session.defaultRestTime,
			currentPhase: hasWarmup ? 'warmup' : 'exercises',
			isPaused: false,
			pausedRemainingTime: null
		});
	}
});
