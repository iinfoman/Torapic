import { ITEMS } from '../src/data/seed';

import type { CloudMatch } from './identify';

/** Free on Cloudflare's daily Workers AI allowance; no API key, just the AI binding. */
export const WORKERS_AI_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

/** The subset of Cloudflare's `Ai` binding used here; tests pass a stub. */
export type AiRunner = { run(model: string, inputs: Record<string, unknown>): Promise<unknown> };

const IDS = new Set(ITEMS.map((i) => i.id));
const CONFIDENCE = { high: 0.92, medium: 0.72, low: 0.4 } as const;
const NONE: CloudMatch = { itemId: 'none', confidence: 0, seen: '' };

const SYSTEM = `You identify foods, herbs, spices and supplements in photos for a nutrition app.
Library (id: name, also known as):
${ITEMS.map((i) => `${i.id}: ${i.name}, ${i.aliases.slice(0, 3).join(', ')}`).join('\n')}

Pick the library id the photo shows (loose produce, dried herb, ground spice, or a product whose main ingredient it is; read label text). Use "none" if it is not in the library.
Reply with ONLY this JSON, nothing else:
{"item_id": "<library id or none>", "confidence": "high|medium|low", "seen": "<what you see, max 6 words>"}`;

/** Pulls the first JSON object out of a chatty reply and validates it against the library. */
export function parseVisionReply(reply: string): CloudMatch {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start < 0 || end <= start) return NONE;
  let parsed: { item_id?: unknown; confidence?: unknown; seen?: unknown };
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return NONE;
  }
  const seen = typeof parsed.seen === 'string' ? parsed.seen.trim().slice(0, 60) : '';
  const confidence =
    typeof parsed.confidence === 'string' && parsed.confidence in CONFIDENCE
      ? CONFIDENCE[parsed.confidence as keyof typeof CONFIDENCE]
      : CONFIDENCE.low;
  // Smaller open models sometimes invent ids; anything outside the library becomes "none".
  const itemId = typeof parsed.item_id === 'string' && IDS.has(parsed.item_id) ? parsed.item_id : 'none';
  return { itemId, confidence: itemId === 'none' && !seen ? 0 : confidence, seen };
}

function replyText(result: unknown): string {
  const response = (result as { response?: unknown } | null)?.response;
  return typeof response === 'string' ? response : '';
}

export async function identifyWithWorkersAI(
  ai: AiRunner,
  photo: { base64: string; mediaType: string }
): Promise<CloudMatch> {
  const inputs = {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: 'Identify the main item in this photo.' },
    ],
    image: `data:${photo.mediaType};base64,${photo.base64}`,
    max_tokens: 120,
    temperature: 0,
  };
  try {
    return parseVisionReply(replyText(await ai.run(WORKERS_AI_MODEL, inputs)));
  } catch (error) {
    // Meta's license must be accepted once per account; do it and retry.
    if (!/agree/i.test(String(error))) throw error;
    await ai.run(WORKERS_AI_MODEL, { prompt: 'agree' });
    return parseVisionReply(replyText(await ai.run(WORKERS_AI_MODEL, inputs)));
  }
}
