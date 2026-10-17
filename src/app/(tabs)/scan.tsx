import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glass, GlowBackdrop } from '@/components/glass';
import { ScanHud } from '@/components/scan-hud';
import type { ItemRecord } from '@/data/types';
import { getItem } from '@/db/repository';
import { CategoryThemes, Palette, Radius, Space, Type, WebTabInset, glow } from '@/theme/tokens';
import { MIN_CONFIDENCE, demoClassifier } from '@/vision/classifier';

const STEPS = ['Detecting object…', 'Reading bio-active profile…', 'Matching offline library…'];
const IDLE_COLOR = '#7FE7FF';

type Phase = { kind: 'idle' } | { kind: 'scanning'; step: number } | { kind: 'locked'; item: ItemRecord };

/**
 * Scan HUD. The live camera feed and on-device model arrive in the Edge-AI
 * phase; for now a demo classifier drives the full scan → lock → insight flow.
 */
export default function ScanScreen() {
  const db = useSQLiteContext();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  const scan = async () => {
    if (phase.kind === 'scanning') return;
    setPhase({ kind: 'scanning', step: 0 });
    later(650, () => setPhase({ kind: 'scanning', step: 1 }));
    later(1300, () => setPhase({ kind: 'scanning', step: 2 }));

    const [best] = await demoClassifier.classify({ uri: 'demo' });
    const item = best && best.confidence >= MIN_CONFIDENCE ? await getItem(db, best.itemId) : null;

    later(1950, () => {
      if (!item) return setPhase({ kind: 'idle' });
      setPhase({ kind: 'locked', item });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      later(900, () => {
        router.push({ pathname: '/item/[id]', params: { id: item.id } });
        setPhase({ kind: 'idle' });
      });
    });
  };

  const color = phase.kind === 'locked' ? CategoryThemes[phase.item.category].accent : IDLE_COLOR;
  const status =
    phase.kind === 'idle'
      ? 'Point at a food, herb, spice or supplement label'
      : phase.kind === 'scanning'
        ? STEPS[phase.step]
        : `Locked: ${phase.item.name}`;

  return (
    <View style={styles.screen}>
      <GlowBackdrop category={phase.kind === 'locked' ? phase.item.category : undefined} strength={0.8} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <Glass style={styles.offline}>
            <View style={[styles.dot, glow('#5CF2B6', 8, 1)]} />
            <Text style={[Type.caption, { color: Palette.textMuted }]}>On-device AI · works offline</Text>
          </Glass>
        </View>

        <View style={styles.center}>
          <ScanHud state={phase.kind} color={color} />
          <Animated.Text
            key={status}
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(120)}
            style={[Type.bodyStrong, styles.status, { color: phase.kind === 'locked' ? color : Palette.text }]}>
            {status}
          </Animated.Text>
        </View>

        <View style={styles.bottom}>
          <Pressable
            onPress={scan}
            accessibilityRole="button"
            accessibilityLabel="Scan"
            style={({ pressed }) => [styles.shutterOuter, glow(color, 30, 0.6), pressed && { transform: [{ scale: 0.95 }] }]}>
            <View style={[styles.shutterInner, { borderColor: color }]} />
          </Pressable>
          <Text style={[Type.caption, { color: Palette.textFaint }]}>Demo mode: camera arrives with the Edge-AI build</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.bg },
  safe: { flex: 1, padding: Space.lg },
  top: { alignItems: 'center', marginTop: Space.sm + WebTabInset },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#5CF2B6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.xxl },
  status: { textAlign: 'center', minHeight: 24 },
  bottom: { alignItems: 'center', gap: Space.md, paddingBottom: 96 },
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
});
