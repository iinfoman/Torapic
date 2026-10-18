import { handleIdentify } from '../server/handler';

type Env = {
  /** The exported web app (dist/), served by Workers static assets. */
  ASSETS: Fetcher;
  /** Secret: `npx wrangler secret put ANTHROPIC_API_KEY`. */
  ANTHROPIC_API_KEY?: string;
  /** Optional var; defaults to claude-opus-5-5. claude-haiku-5-5 is ~40× cheaper per scan. */
  TORAPIC_VISION_MODEL?: string;
};

/**
 * Only /api/* reaches this code (assets.run_worker_first); every other path is
 * served straight from static assets with the SPA fallback.
 */
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/identify') {
      return handleIdentify(request, { apiKey: env.ANTHROPIC_API_KEY, model: env.TORAPIC_VISION_MODEL });
    }
    if (pathname.startsWith('/api/')) return Response.json({ error: 'not-found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
