import type { Text } from '@infinitered/react-native-mlkit-text-recognition';
import { requireOptionalNativeModule } from 'expo';

import { ITEMS } from '@/data/seed';

import type { VisionClassifier } from './classifier';
import { matchLabel, type LabelLine } from './label-matcher';

type TextRecognitionModule = { recognizeText(imagePath: string): Promise<Text> };

/**
 * ML Kit text recognition, present only in development and store builds.
 * Loaded optionally (not via the package's entry point, which throws on
 * import) so Expo Go and web fall back to the demo classifier instead of crashing.
 */
const native = requireOptionalNativeModule<TextRecognitionModule>('RNMLKitTextRecognition');

const TARGETS = ITEMS.map((i) => ({ itemId: i.id, name: i.name, aliases: i.aliases }));

/** Reads the product label on-device and matches it against the offline library. */
export const ocrClassifier: VisionClassifier | null = native
  ? {
      async classify(input) {
        if (!('uri' in input)) return [];
        const result = await native.recognizeText(input.uri);
        const lines: LabelLine[] = result.blocks.flatMap((block) =>
          block.lines.map((line) => ({ text: line.text, height: line.frame.bottom - line.frame.top }))
        );
        return matchLabel(lines, TARGETS);
      },
    }
  : null;
