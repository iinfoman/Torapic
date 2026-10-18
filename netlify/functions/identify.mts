import Anthropic from '@anthropic-ai/sdk';

import { DEFAULT_MODEL, identifyPhoto } from '../../server/identify';

/** ~3 MB of JPEG; the app resizes to 1024px first, so real photos are far smaller. */
const MAX_BASE64_LENGTH = 4_000_000;
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * POST { image: <base64>, mediaType } → { itemId, confidence, seen }.
 * Serves at /.netlify/functions/identify. Needs ANTHROPIC_API_KEY set in the
 * Netlify UI (scope: Functions).
 */
export default async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'method-not-allowed' }, { status: 405 });

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return Response.json({ error: 'not-configured' }, { status: 503 });

  let body: { image?: unknown; mediaType?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'bad-json' }, { status: 400 });
  }
  const { image, mediaType } = body;
  if (typeof image !== 'string' || image.length === 0 || image.length > MAX_BASE64_LENGTH) {
    return Response.json({ error: 'bad-image' }, { status: 400 });
  }
  if (typeof mediaType !== 'string' || !MEDIA_TYPES.has(mediaType)) {
    return Response.json({ error: 'bad-media-type' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
  const model = Netlify.env.get('TORAPIC_VISION_MODEL') || DEFAULT_MODEL;

  try {
    const match = await identifyPhoto(
      client,
      { base64: image, mediaType: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' },
      model
    );
    return Response.json(match);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: 'busy' }, { status: 429 });
    if (error instanceof Anthropic.APIError) {
      console.error('[identify] API error', error.status, error.message);
      return Response.json({ error: 'upstream' }, { status: 502 });
    }
    console.error('[identify]', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
};
