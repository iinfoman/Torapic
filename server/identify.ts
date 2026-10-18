import Anthropic from '@anthropic-ai/sdk';

import { ITEMS } from '../src/data/seed';

/** Default per the house rule; set TORAPIC_VISION_MODEL=claude-haiku-5-5 for ~40× cheaper scans. */
export const DEFAULT_MODEL = 'claude-opus-5-5';

export type CloudMatch = {
  /** A library item id, or "none" when the photo shows something the library doesn't have. */
  itemId: string;
  confidence: number;
  /** What the model sees, in a few words ("fresh ginger root"). */
  seen: string;
};

const CONFIDENCE = { high: 0.92, medium: 0.72, low: 0.4 } as const;

const SCHEMA = {
  type: 'object',
  properties: {
    item_id: { type: 'string', enum: [...ITEMS.map((i) => i.id), 'none'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    seen: { type: 'string' },
  },
  required: ['item_id', 'confidence', 'seen'],
  additionalProperties: false,
};

const LIBRARY = ITEMS.map((i) => `- ${i.id}: ${i.name} (${i.kind}; also: ${i.aliases.join(', ')})`).join('\n');

const SYSTEM = `You identify foods, herbs, spices and supplements in photos for a nutrition app.

The app's library:
${LIBRARY}

Look at the photo and pick the library item it shows. It may be loose produce, a dried herb, a ground spice, or a packaged product; read any label text. A product counts as an item when that item is its main ingredient (e.g. "Turmeric Curcumin with BioPerine" is turmeric).
- item_id: the matching library id, or "none" if the main subject is not in the library or no food/supplement is visible.
- confidence: "high" when clearly identifiable, "medium" when likely, "low" when guessing.
- seen: what you actually see, in at most 6 plain words (e.g. "fresh ginger root", "bottle of berberine capsules").`;

/** Minimal surface of the SDK client this module uses; lets tests pass a stub. */
export type MessagesClient = Pick<Anthropic, 'beta'>;

export async function identifyPhoto(
  client: MessagesClient,
  photo: { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' },
  model: string = DEFAULT_MODEL
): Promise<CloudMatch> {
  // Server-side refusal fallback where the model supports it (not Haiku).
  const fallback = model.startsWith('claude-opus') || model.startsWith('claude-fable');

  const response = await client.beta.messages.create({
    model,
    max_tokens: 2048,
    ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    // A single-label classification: low effort keeps it fast and cheap.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: photo.mediaType, data: photo.base64 } },
          { type: 'text', text: 'Identify the main item in this photo.' },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') return { itemId: 'none', confidence: 0, seen: '' };

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return { itemId: 'none', confidence: 0, seen: '' };

  const parsed = JSON.parse(text.text) as { item_id: string; confidence: keyof typeof CONFIDENCE; seen: string };
  return {
    itemId: parsed.item_id,
    confidence: CONFIDENCE[parsed.confidence] ?? CONFIDENCE.low,
    seen: parsed.seen.slice(0, 60),
  };
}
