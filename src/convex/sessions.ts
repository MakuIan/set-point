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
 * Create a new workout session and its first exercise snapshot.
 */
export const create = mutation({
	args: {
		name: v.string(),
		setsCount: v.number(),
		restTime: v.number()
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		const sessionId = await ctx.db.insert('workoutSessions', {
			userId: user._id,
			status: 'active',
			startedAt: Date.now(),
			currentExerciseIndex: 0,
			currentSet: 1,
			timerEndTime: null,
			timerDuration: args.restTime
		});

		await ctx.db.insert('sessionExercises', {
			sessionId,
			name: args.name,
			setsCount: args.setsCount,
			restTime: args.restTime,
			order: 0
		});

		return sessionId;
	}
});

/**
 * Update details of a session's exercise.
 */
export const update = mutation({
	args: {
		sessionId: v.id('workoutSessions'),
		exerciseId: v.id('sessionExercises'),
		name: v.string(),
		setsCount: v.number(),
		restTime: v.number()
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		const session = await ctx.db.get(args.sessionId);
		if (!session || session.userId !== user._id) {
			throw new Error('Unauthorized or session not found');
		}
		await ctx.db.patch(args.exerciseId, {
			name: args.name,
			setsCount: args.setsCount,
			restTime: args.restTime
		});

		await ctx.db.patch(args.sessionId, {
			timerDuration: args.restTime
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
