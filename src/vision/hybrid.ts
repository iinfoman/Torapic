import { MIN_CONFIDENCE, type Classification, type VisionClassifier } from './classifier';

/**
 * Offline-first recognition: the free on-device reader answers when it's
 * confident; otherwise, and only when reachable, the cloud model looks at the
 * photo. If the cloud is unreachable (no signal, timeout) the on-device result
 * stands, so scanning never depends on a connection.
 */
export function hybridClassifier(local: VisionClassifier | null, cloud: VisionClassifier | null): VisionClassifier | null {
  if (!local && !cloud) return null;
  return {
    async prepare() {
      await local?.prepare?.();
    },
    async classify(input) {
      let onDevice: Classification[] = [];
      if (local) {
        try {
          onDevice = await local.classify(input);
        } catch (error) {
          console.warn('[scan] on-device recognition failed', error);
        }
      }
      if (onDevice.some((m) => m.confidence >= MIN_CONFIDENCE) || !cloud) return onDevice;

      try {
        return await cloud.classify(input);
      } catch (error) {
        console.warn('[scan] cloud recognition unavailable', error);
        return onDevice;
      }
    },
  };
}
