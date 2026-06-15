import { betterAuth } from 'better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { createClient, type CreateAuth } from '@convex-dev/better-auth';
import type { GenericCtx } from '@convex-dev/better-auth';
import type { DataModel } from './_generated/dataModel.js';
import { components } from './_generated/api.js';
import authConfig from './auth.config.js';

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth: CreateAuth<DataModel> = (ctx: GenericCtx<DataModel>) => {
	return betterAuth({
		database: authComponent.adapter(ctx),
		baseURL: process.env.CONVEX_SITE_URL,
		emailAndPassword: {
			enabled: true
		},
		socialProviders: {
			google: {
				clientId: process.env.GOOGLE_CLIENT_ID!,
				clientSecret: process.env.GOOGLE_CLIENT_SECRET!
			}
		},
		trustedOrigins: [process.env.SITE_URL!],
		plugins: [convex({ authConfig })]
	});
};

