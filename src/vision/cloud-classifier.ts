import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import type { VisionClassifier } from './classifier';

/** Longest edge sent to the cloud: plenty to read labels, keeps uploads ~100–200 KB. */
const MAX_EDGE = 1024;
const TIMEOUT_MS = 15_000;

/**
 * The web app calls its own origin. Native builds need EXPO_PUBLIC_API_URL
 * (e.g. https://torapic.<you>.workers.dev); without it, scanning stays on-device only.
 */
function endpoint(): string | null {
  if (Platform.OS === 'web') return '/api/identify';
  const base = process.env.EXPO_PUBLIC_API_URL;
  return base ? `${base.replace(/\/$/, '')}/api/identify` : null;
}

async function toJpegBase64(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: MAX_EDGE }).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('Could not encode photo');
  return saved.base64;
}

const url = endpoint();

/** Vision AI behind the app's own serverless function; the API key never ships in the app. */
export const cloudClassifier: VisionClassifier | null = url
  ? {
      async classify(input) {
        if (!('uri' in input)) return [];
        const image = await toJpegBase64(input.uri);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image, mediaType: 'image/jpeg' }),
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`identify failed: ${res.status}`);
          const match = (await res.json()) as { itemId: string; confidence: number; seen: string };
          return [{ itemId: match.itemId, confidence: match.confidence, label: match.seen || undefined }];
        } finally {
          clearTimeout(timer);
        }
      },
    }
  : null;
