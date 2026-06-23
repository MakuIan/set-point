import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	/**
	 * 1. WORKOUT TEMPLATES (The Blueprint Folder)
	 * Purpose: Reusable routines created once so the user never has to re-type them.
	 * Acts as a container for specific workout names (e.g., "Push Day", "Leg Day").
	 */
	workoutTemplates: defineTable({
		userId: v.string(), // Links to Better-Auth user ID
		name: v.string(), // The custom name given by the user (e.g., "Upper Body A", "Legs")
		createdAt: v.number()
	}).index('by_user', ['userId']),

	/**
	 * 2. TEMPLATE EXERCISES (The Blueprint Contents)
	 * Purpose: Stores the static list of movements belonging to a workout template.
	 * Holds the default target sets, order, and rest time used to spin up a live session.
	 */
	templateExercises: defineTable({
		templateId: v.id('workoutTemplates'),
		name: v.string(), // e.g., "Dumbbell Bench Press"
		setsCount: v.number(), // Default number of sets, e.g., 3
		restTime: v.number(), // Rest duration in seconds, e.g., 60
		description: v.optional(v.string()), // Optional exercise description/notes
		order: v.number(), // Execution order index (0, 1, 2...)
		phase: v.optional(v.string()), // 'warmup' | 'exercises' | 'cooldown'
		duration: v.optional(v.number()) // Exercise duration in seconds (for warmup/cooldown)
	}).index('by_template', ['templateId']),

	/**
	 * 3. WORKOUT SESSIONS (The Live Engine & History Log)
	 * Purpose: Manages real-time multi-device sync state while a workout is active.
	 * When status is "completed", 'endedAt' is used to compute relative time history (e.g., "2 days ago").
	 */
	workoutSessions: defineTable({
		userId: v.string(),
		name: v.string(),
		templateId: v.optional(v.id('workoutTemplates')), // Tracks which template this session belongs to
		status: v.string(), // "active" | "completed" | "cancelled"
		startedAt: v.number(),
		endedAt: v.optional(v.number()), // Recorded when the user presses "Finish"

		// --- Live Synchronization State ---
		currentExerciseIndex: v.number(), // Track which exercise the user is currently on
		currentSet: v.number(), // Track the active set (e.g., 1, 2, 3)

		// The precise Unix timestamp (ms) when the current rest timer ends.
		timerEndTime: v.union(v.number(), v.null()),
		// Keeps track of the total planned rest time for the current exercise
		timerDuration: v.number(),
		defaultSetsCount: v.number(),
		defaultRestTime: v.number(),

		// --- Warm-up & Cool-down timers ---
		warmupDuration: v.optional(v.union(v.number(), v.null())),
		cooldownDuration: v.optional(v.union(v.number(), v.null())),
		currentPhase: v.optional(v.string()), // "warmup" | "exercises" | "cooldown"
		isPaused: v.optional(v.boolean()),
		pausedRemainingTime: v.optional(v.union(v.number(), v.null()))
	})
		.index('by_user_status', ['userId', 'status'])
		// NEW INDEX: Allows you to instantly fetch the latest completed session for a specific routine
		.index('by_template_status_ended', ['templateId', 'status', 'endedAt']),

	/**
	 * 4. SESSION EXERCISES (The Immutable Live Snapshot)
	 * Purpose: A snapshot copy of template exercises generated at workout start.
	 * Protects history if a master template changes later, and allows active session customization.
	 */
	sessionExercises: defineTable({
		sessionId: v.id('workoutSessions'),
		name: v.string(),
		setsCount: v.number(),
		restTime: v.number(),
		description: v.optional(v.string()),
		order: v.number(),
		phase: v.optional(v.string()), // 'warmup' | 'exercises' | 'cooldown'
		duration: v.optional(v.number()) // Exercise duration in seconds (for warmup/cooldown)
	}).index('by_session', ['sessionId']),

	/**
	 * 5. LOGGED SETS (The Performance Ledger)
	 * Purpose: Tracks granular transactional data (weight, reps) for progressive overload.
	 * Synchronizes checked state instantly across multiple user screens via WebSockets.
	 */
	loggedSets: defineTable({
		sessionId: v.id('workoutSessions'),
		exerciseId: v.id('sessionExercises'),
		setIndex: v.number(), // 0-indexed set number (0 = Set 1, 1 = Set 2...)
		weight: v.optional(v.number()), // Weight used (e.g., in kg for dumbbell tracking)
		reps: v.optional(v.number()), // Target or completed reps
		isCompleted: v.boolean() // Checkbox state for finishing the set
	}).index('by_session_exercise', ['sessionId', 'exerciseId'])
});
