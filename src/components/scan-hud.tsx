import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { glow } from '@/theme/tokens';

const PARTICLES = 10;

/**
 * Glassmorphic targeting ring. Idle: slow rotation and breathing glow.
 * Scanning: faster spin with orbiting particles. Locked: snaps tight and
 * flares in the result's category color.
 */
export function ScanHud({
  size = 260,
  state,
  color,
}: {
  size?: number;
  state: 'idle' | 'scanning' | 'locked';
  color: string;
}) {
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  const lock = useSharedValue(0);

  useEffect(() => {
    const period = state === 'scanning' ? 1400 : 9000;
    spin.set(withRepeat(withTiming(spin.get() + 360, { duration: period, easing: Easing.linear }), -1, false));
    pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true));
    lock.set(withSpring(state === 'locked' ? 1 : 0, { damping: 12, stiffness: 160 }));
    return () => cancelAnimation(spin);
  }, [state, spin, pulse, lock]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }, { scale: 1 - lock.value * 0.12 }],
  }));
  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.35 + lock.value * 0.3,
    transform: [{ scale: 0.96 + pulse.value * 0.06 - lock.value * 0.1 }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          styles.abs,
          { width: size, height: size, borderRadius: size / 2, borderColor: `${color}55` },
          glow(color, 48, 0.55),
          halo,
        ]}
      />
      <Animated.View
        style={[
          styles.abs,
          styles.dashed,
          { width: size * 0.9, height: size * 0.9, borderRadius: size, borderColor: color },
          ring,
        ]}
      />
      <Corners size={size * 0.62} color={color} />
      {state === 'scanning'
        ? Array.from({ length: PARTICLES }, (_, i) => (
            <Particle key={i} index={i} radius={size * 0.45} color={color} spin={spin} />
          ))
        : null}
    </View>
  );
}

function Particle({
  index,
  radius,
  color,
  spin,
}: {
  index: number;
  radius: number;
  color: string;
  spin: SharedValue<number>;
}) {
  const offset = (index / PARTICLES) * Math.PI * 2;
  const speed = 0.6 + (index % 3) * 0.25;
  const style = useAnimatedStyle(() => {
    const a = offset + (spin.value * Math.PI * speed) / 180;
    const r = radius * (0.82 + 0.12 * Math.sin(a * 3));
    return {
      transform: [{ translateX: Math.cos(a) * r }, { translateY: Math.sin(a) * r }],
      opacity: 0.4 + 0.6 * Math.abs(Math.sin(a * 2)),
    };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: color }, glow(color, 8, 1), style]} />;
}

function Corners({ size, color }: { size: number; color: string }) {
  const arm = size * 0.18;
  const base = { position: 'absolute' as const, width: arm, height: arm, borderColor: color };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[base, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 }]} />
      <View style={[base, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 }]} />
      <View style={[base, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 }]} />
      <View style={[base, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', borderWidth: 1 },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed' },
  particle: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
});
