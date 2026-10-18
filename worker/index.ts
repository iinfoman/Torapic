import { handleIdentify } from '../server/handler';
import type { AiRunner } from '../server/workers-ai';

type Env = {
  /** The exported web app (dist/), served by Workers static assets. */
  ASSETS: Fetcher;
  /** Cloudflare Workers AI: free vision model, used unless a Claude key is set. */
  AI: Ai;
  /** Optional secret: `npx wrangler secret put ANTHROPIC_API_KEY` switches scans to Claude. */
  ANTHROPIC_API_KEY?: string;
  /** Optional var for the Claude path; defaults to claude-opus-5-5. claude-haiku-5-5 is ~40× cheaper per scan. */
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
      return handleIdentify(request, {
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.TORAPIC_VISION_MODEL,
        ai: env.AI as unknown as AiRunner,
      });
    }
    if (pathname.startsWith('/api/')) return Response.json({ error: 'not-found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
