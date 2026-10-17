import type { ItemRecord } from '@/data/types';

import { MIN_CONFIDENCE, type VisionClassifier } from './classifier';

export type ScanMiss = 'capture-failed' | 'low-confidence' | 'not-in-library';

export type ScanOutcome =
  | { kind: 'locked'; item: ItemRecord; confidence: number }
  | { kind: 'miss'; reason: ScanMiss };

/**
 * One scan, start to finish: capture a photo, classify it on-device, and
 * resolve the best confident match that exists in the offline library.
 * Never throws; every failure becomes a `miss` the HUD can explain.
 */
export async function identify({
  capture,
  classifier,
  lookup,
  minConfidence = MIN_CONFIDENCE,
}: {
  capture: () => Promise<string | undefined>;
  classifier: VisionClassifier;
  lookup: (itemId: string) => Promise<ItemRecord | null>;
  minConfidence?: number;
}): Promise<ScanOutcome> {
  let uri: string | undefined;
  try {
    uri = await capture();
  } catch {
    uri = undefined;
  }
  if (!uri) return { kind: 'miss', reason: 'capture-failed' };

  let matches;
  try {
    matches = await classifier.classify({ uri });
  } catch {
    return { kind: 'miss', reason: 'low-confidence' };
  }

  const confident = matches.filter((m) => m.confidence >= minConfidence).sort((a, b) => b.confidence - a.confidence);
  if (confident.length === 0) return { kind: 'miss', reason: 'low-confidence' };

  // The model can know labels the bundled library doesn't ship yet; skip to the next confident match.
  for (const match of confident) {
    const item = await lookup(match.itemId);
    if (item) return { kind: 'locked', item, confidence: match.confidence };
  }
  return { kind: 'miss', reason: 'not-in-library' };
}

export const MISS_COPY: Record<ScanMiss, string> = {
  'capture-failed': 'Camera didn’t capture. Try again',
  'low-confidence': 'Couldn’t lock on. Move closer and fill the ring',
  'not-in-library': 'Recognized, but not in your offline library yet',
};
