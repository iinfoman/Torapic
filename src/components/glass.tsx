import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Category } from '@/data/types';
import { CategoryThemes, Palette, Radius } from '@/theme/tokens';

type GlassProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** Tints the glass and its rim with a category accent. */
  category?: Category;
  intensity?: number;
}>;

/** Frosted glass panel with a hairline rim and a soft top highlight. */
export function Glass({ children, style, category, intensity = 28 }: GlassProps) {
  const theme = category ? CategoryThemes[category] : undefined;
  return (
    <View
      style={[
        styles.glass,
        { borderColor: theme ? `${theme.accent}40` : Palette.hairline },
        style,
      ]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        colors={[theme ? theme.tint : Palette.glassStrong, 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
        style={styles.highlight}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

/**
 * Ambient light behind a screen: two soft color fields in the category's
 * gradient, fading into the base background.
 */
export function GlowBackdrop({ category, strength = 1 }: { category?: Category; strength?: number }) {
  const [a, , c] = category
    ? CategoryThemes[category].gradient
    : (['#3B5BFF', '#000000', '#2EE6A0'] as const);
  const alpha = (x: number) =>
    Math.round(x * strength * 255)
      .toString(16)
      .padStart(2, '0');
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Palette.bg }]} />
      <LinearGradient
        colors={[`${a}${alpha(0.32)}`, `${a}00`]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.6, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${c}00`, `${c}${alpha(0.16)}`]}
        start={{ x: 0.3, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(18,20,28,0.82)',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 60,
  },
});
