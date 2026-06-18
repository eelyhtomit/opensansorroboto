import { sequence } from '@sveltejs/kit/hooks';
import { handleErrorWithSentry, initCloudflareSentryHandle, sentryHandle } from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';

// The app deploys to the Cloudflare Workers runtime (adapter-cloudflare).
// `initCloudflareSentryHandle` initialises the Cloudflare-compatible SDK on
// every request (the Workers runtime has no long-lived global init step),
// and `sentryHandle` adds request/trace instrumentation.
//
// We read the DSN from `$env/dynamic/public` (resolved at runtime) rather than
// `$env/static/public` so a missing `PUBLIC_SENTRY_DSN` does not fail the build.
// When the DSN is undefined the Sentry SDK simply stays disabled (no-op).
export const handle = sequence(
	initCloudflareSentryHandle({
		dsn: env.PUBLIC_SENTRY_DSN,

		// We recommend adjusting this value in production, or using a sampler
		// for finer control over the volume of performance traces collected.
		tracesSampleRate: 1.0
	}),
	sentryHandle()
);

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = handleErrorWithSentry();
