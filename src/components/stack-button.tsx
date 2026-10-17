import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSQLiteContext } from 'expo-sqlite';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import type { Category } from '@/data/types';
import { useStack } from '@/state/stack';
import { CategoryThemes, Palette, Radius, Space, Type, glow } from '@/theme/tokens';

/** "+ Add to My Daily Stack" with a springy pop and haptic confirmation. */
export function StackButton({ itemId, category }: { itemId: string; category: Category }) {
  const db = useSQLiteContext();
  const inStack = useStack((s) => s.ids.includes(itemId));
  const toggle = useStack((s) => s.toggle);
  const theme = CategoryThemes[category];
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const onPress = async () => {
    scale.set(withSequence(withSpring(0.94, { damping: 14 }), withSpring(1, { damping: 8, stiffness: 220 })));
    const added = await toggle(db, itemId);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        added ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );
    }
  };

  return (
    <Animated.View style={[styles.wrap, animated, !inStack && glow(theme.accent, 22, 0.45)]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: inStack }}
        accessibilityLabel={inStack ? 'Remove from my daily stack' : 'Add to my daily stack'}>
        {inStack ? (
          <LinearGradient
            colors={[Palette.glassStrong, Palette.glass]}
            style={[styles.button, { borderColor: `${theme.accent}66` }]}>
            <Text style={[styles.label, { color: theme.onTint }]}>✓ In My Daily Stack</Text>
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={theme.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.button, { borderColor: 'transparent' }]}>
            <Text style={[styles.label, { color: '#0B0603' }]}>+ Add to My Daily Stack</Text>
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.md },
  button: {
    height: 54,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
  },
  label: { ...Type.bodyStrong, fontWeight: '800', letterSpacing: 0.2 },
});
