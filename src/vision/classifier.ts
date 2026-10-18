import { ITEMS } from '@/data/seed';

/**
 * Contract between the camera and the rest of the app: a classifier only ever
 * returns item ids from the offline library plus a confidence. Everything the
 * user sees is then read from the local database, so the model can be swapped
 * or retrained without touching content.
 */
export type Classification = { itemId: string; confidence: number };

export interface VisionClassifier {
  /** Top-k matches for one camera frame or photo, best first. */
  classify(input: { uri: string } | { frame: unknown }): Promise<Classification[]>;
}

/** Below this, the HUD asks the user to reframe instead of guessing. */
export const MIN_CONFIDENCE = 0.6;

/**
 * Used where the native recognizer is unavailable (Expo Go, web, no camera):
 * returns a random library item so the scan → insight flow can be demoed.
 */
export const demoClassifier: VisionClassifier = {
  async classify() {
    const pick = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    return [{ itemId: pick.id, confidence: 0.92 }];
  },
};
