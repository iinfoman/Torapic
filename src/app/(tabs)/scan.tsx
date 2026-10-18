import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glass, GlowBackdrop } from '@/components/glass';
import { ScanHud } from '@/components/scan-hud';
import type { ItemRecord } from '@/data/types';
import { getItem } from '@/db/repository';
import { CategoryThemes, Palette, Radius, Space, Type, WebTabInset, glow } from '@/theme/tokens';
import { demoClassifier } from '@/vision/classifier';
import { MISS_COPY, identify, type ScanMiss } from '@/vision/identify';
import { ocrClassifier } from '@/vision/ocr-classifier';

const STEPS = ['Capturing…', 'Reading bio-active profile…', 'Matching offline library…'];
const IDLE_COLOR = '#7FE7FF';
const MISS_COLOR = Palette.warning;
/** The HUD steps stay on screen at least this long, even when the model is faster. */
const MIN_SCAN_MS = 1300;

type Phase =
  | { kind: 'idle' }
  | { kind: 'scanning'; step: number }
  | { kind: 'locked'; item: ItemRecord }
  | { kind: 'miss'; reason: ScanMiss };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function haptic(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS !== 'web') Haptics.notificationAsync(type);
}

/**
 * Live camera with the glass targeting HUD. Snap → on-device classify →
 * offline lookup → lock-on flare → Hero Insight Card. Nothing here needs a network.
 */
export default function ScanScreen() {
  const db = useSQLiteContext();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);
  // The camera unmounts when the tab loses focus; it must report ready again on return.
  useFocusEffect(
    useCallback(
      () => () => {
        setCameraReady(false);
        setTorch(false);
      },
      []
    )
  );

  const live = !!permission?.granted && focused && !cameraError;
  // Real label reading needs a live photo and the native text recognizer (dev/store builds).
  const realAI = live && !!ocrClassifier;

  const capture = async () => {
    if (!camera.current || !cameraReady) return undefined;
    const photo = await camera.current.takePictureAsync({ quality: 0.6, shutterSound: false });
    // Freeze the frame while we analyse it, like a viewfinder lock.
    camera.current.pausePreview().catch(() => {});
    return photo?.uri;
  };

  const reset = () => {
    camera.current?.resumePreview().catch(() => {});
    setPhase({ kind: 'idle' });
  };

  const scan = async () => {
    if (phase.kind === 'scanning' || phase.kind === 'locked') return;
    clearTimers();
    setPhase({ kind: 'scanning', step: 0 });
    later(MIN_SCAN_MS / 3, () => setPhase((p) => (p.kind === 'scanning' ? { kind: 'scanning', step: 1 } : p)));
    later((MIN_SCAN_MS * 2) / 3, () => setPhase((p) => (p.kind === 'scanning' ? { kind: 'scanning', step: 2 } : p)));

    const [outcome] = await Promise.all([
      identify({
        // Without a camera (simulator, denied permission) the demo still runs end to end.
        capture: live ? capture : async () => 'demo://no-camera',
        classifier: realAI ? ocrClassifier! : demoClassifier,
        lookup: (id) => getItem(db, id),
      }),
      wait(MIN_SCAN_MS),
    ]);
    clearTimers();

    if (outcome.kind === 'miss') {
      setPhase({ kind: 'miss', reason: outcome.reason });
      haptic(Haptics.NotificationFeedbackType.Error);
      later(2200, reset);
      return;
    }

    setPhase({ kind: 'locked', item: outcome.item });
    haptic(Haptics.NotificationFeedbackType.Success);
    later(900, () => {
      router.push({ pathname: '/item/[id]', params: { id: outcome.item.id } });
      setTorch(false);
      reset();
    });
  };

  const color =
    phase.kind === 'locked'
      ? CategoryThemes[phase.item.category].accent
      : phase.kind === 'miss'
        ? MISS_COLOR
        : IDLE_COLOR;
  const status =
    phase.kind === 'idle'
      ? 'Point at a food, herb, spice or supplement label'
      : phase.kind === 'scanning'
        ? STEPS[phase.step]
        : phase.kind === 'locked'
          ? `Locked: ${phase.item.name}`
          : MISS_COPY[phase.reason];

  return (
    <View style={styles.screen}>
      <GlowBackdrop category={phase.kind === 'locked' ? phase.item.category : undefined} strength={0.8} />
      {live ? (
        <>
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            animateShutter={false}
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => setCameraError(true)}
          />
          <LinearGradient
            colors={['rgba(5,6,10,0.85)', 'rgba(5,6,10,0.15)', 'rgba(5,6,10,0.15)', 'rgba(5,6,10,0.9)']}
            locations={[0, 0.25, 0.6, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : null}

      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <Glass style={styles.pill}>
            <View style={[styles.dot, glow('#5CF2B6', 8, 1)]} />
            <Text style={[Type.caption, { color: Palette.textMuted }]}>On-device AI · works offline</Text>
          </Glass>
          {live && Platform.OS !== 'web' ? (
            <Pressable
              onPress={() => setTorch((t) => !t)}
              accessibilityRole="switch"
              accessibilityState={{ checked: torch }}
              accessibilityLabel="Flashlight"
              hitSlop={8}>
              <Glass style={[styles.torch, torch && { borderColor: Palette.warning }, torch && glow(Palette.warning, 16, 0.6)]}>
                <Text style={[Type.bodyStrong, { color: torch ? Palette.warning : Palette.textMuted }]}>ϟ</Text>
              </Glass>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.center}>
          {permission && !permission.granted ? (
            <PermissionCard canAsk={permission.canAskAgain} onRequest={requestPermission} />
          ) : (
            <>
              <ScanHud state={phase.kind === 'miss' ? 'idle' : phase.kind} color={color} />
              <Animated.Text
                key={status}
                entering={FadeIn.duration(220)}
                exiting={FadeOut.duration(120)}
                style={[Type.bodyStrong, styles.status, { color: phase.kind === 'idle' ? Palette.text : color }]}>
                {status}
              </Animated.Text>
            </>
          )}
        </View>

        <View style={styles.bottom}>
          <Pressable
            onPress={scan}
            disabled={live && !cameraReady}
            accessibilityRole="button"
            accessibilityLabel="Take photo to identify"
            style={({ pressed }) => [
              styles.shutterOuter,
              glow(color, 30, 0.6),
              pressed && { transform: [{ scale: 0.95 }] },
              live && !cameraReady && { opacity: 0.5 },
            ]}>
            <View style={[styles.shutterInner, { borderColor: color }]} />
          </Pressable>
          <Pressable onPress={() => router.navigate('/')} hitSlop={8}>
            <Text style={[Type.caption, { color: Palette.textMuted }]}>
              Or <Text style={{ color: Palette.text, textDecorationLine: 'underline' }}>type a goal or ingredient</Text>
            </Text>
          </Pressable>
          <Text style={[Type.caption, styles.note]}>
            {realAI
              ? 'Reads product labels on-device. Loose produce recognition is coming next'
              : 'Demo mode: matches are random. Install the Torapic dev build for real label reading'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function PermissionCard({ canAsk, onRequest }: { canAsk: boolean; onRequest: () => void }) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.permissionWrap}>
      <Glass style={styles.permission}>
        <Text style={[Type.title, { color: Palette.text, textAlign: 'center' }]}>Scan anything, instantly</Text>
        <Text style={[Type.body, { color: Palette.textMuted, textAlign: 'center' }]}>
          Torapic identifies foods, herbs and supplement labels on your phone. Photos never leave your device.
        </Text>
        <Pressable
          onPress={canAsk ? onRequest : () => Linking.openSettings()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.permissionButton, glow(IDLE_COLOR, 20, 0.5), pressed && { opacity: 0.85 }]}>
          <Text style={[Type.bodyStrong, { color: '#041016', fontWeight: '800' }]}>
            {canAsk ? 'Enable camera' : 'Open Settings'}
          </Text>
        </Pressable>
        {!canAsk ? (
          <Text style={[Type.caption, { color: Palette.textFaint, textAlign: 'center' }]}>
            Camera access is off for Torapic. Turn it on in Settings, or tap the shutter for a demo scan.
          </Text>
        ) : null}
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.bg },
  safe: { flex: 1, padding: Space.lg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    marginTop: Space.sm + WebTabInset,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.pill,
  },
  torch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#5CF2B6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.xxl },
  status: {
    textAlign: 'center',
    minHeight: 24,
    paddingHorizontal: Space.lg,
    // Stays legible over bright camera feeds.
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 10,
  },
  bottom: { alignItems: 'center', gap: Space.md, paddingBottom: 88 },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: Palette.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.9)' },
  note: { color: Palette.textFaint, textAlign: 'center' },
  permissionWrap: { alignSelf: 'stretch' },
  permission: { padding: Space.xl, gap: Space.lg, alignItems: 'center', borderRadius: Radius.xl },
  permissionButton: {
    backgroundColor: IDLE_COLOR,
    borderRadius: Radius.md,
    height: 50,
    paddingHorizontal: Space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
