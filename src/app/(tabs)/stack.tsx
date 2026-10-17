import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glass, GlowBackdrop } from '@/components/glass';
import { ItemRow } from '@/components/item-tile';
import type { Category } from '@/data/types';
import { getStack } from '@/db/repository';
import { useDbQuery } from '@/hooks/use-db-query';
import { useStack } from '@/state/stack';
import { CategoryThemes, Palette, Radius, Space, Type, WebTabInset, glow } from '@/theme/tokens';

export default function StackScreen() {
  const db = useSQLiteContext();
  const version = useStack((s) => s.version);
  const toggle = useStack((s) => s.toggle);
  const { data: items } = useDbQuery(getStack, [version]);

  const counts = (items ?? []).reduce<Record<Category, number>>(
    (acc, i) => ({ ...acc, [i.category]: acc[i.category] + 1 }),
    { metabolic: 0, longevity: 0, protection: 0 }
  );

  return (
    <View style={styles.screen}>
      <GlowBackdrop category="longevity" strength={0.6} />
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={[Type.overline, { color: Palette.textFaint }]}>Your routine</Text>
            <Text style={[Type.display, { color: Palette.text }]}>My Daily Stack</Text>
          </View>

          {items && items.length > 0 ? (
            <>
              <View style={styles.balance}>
                {(Object.keys(counts) as Category[]).map((c) => {
                  const t = CategoryThemes[c];
                  return (
                    <Glass key={c} category={c} style={styles.balanceCell}>
                      <Text style={[Type.title, { color: t.accent }, { textShadowColor: t.accent, textShadowRadius: 12 }]}>
                        {counts[c]}
                      </Text>
                      <Text style={[Type.caption, { color: t.onTint }]} numberOfLines={2}>
                        {t.label}
                      </Text>
                    </Glass>
                  );
                })}
              </View>

              {items.map((item, i) => (
                <Animated.View key={item.id} entering={FadeInDown.delay(i * 40).springify()} layout={LinearTransition.springify()}>
                  <ItemRow
                    item={item}
                    subtitle={item.primaryBenefitLabel}
                    trailing={
                      <Pressable
                        onPress={() => toggle(db, item.id)}
                        hitSlop={12}
                        accessibilityLabel={`Remove ${item.name}`}
                        style={styles.remove}>
                        <Text style={[Type.bodyStrong, { color: Palette.textMuted }]}>✕</Text>
                      </Pressable>
                    }
                  />
                </Animated.View>
              ))}
            </>
          ) : items ? (
            <Glass style={styles.empty}>
              <View style={[styles.emptyOrb, glow('#A66BFF', 40, 0.6)]} />
              <Text style={[Type.heading, { color: Palette.text, textAlign: 'center' }]}>Your stack is empty</Text>
              <Text style={[Type.body, { color: Palette.textMuted, textAlign: 'center' }]}>
                Scan or search an ingredient, then tap “+ Add to My Daily Stack” to build your routine.
              </Text>
            </Glass>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.bg },
  flex: { flex: 1 },
  content: { padding: Space.lg, paddingBottom: 120, gap: Space.md },
  header: { gap: Space.sm, marginTop: Space.md + WebTabInset, marginBottom: Space.sm },
  balance: { flexDirection: 'row', gap: Space.sm, marginBottom: Space.sm },
  balanceCell: { flex: 1, padding: Space.md, gap: Space.xs, borderRadius: Radius.md },
  remove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.glass,
  },
  empty: { padding: Space.xxl, alignItems: 'center', gap: Space.md, marginTop: Space.xl },
  emptyOrb: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#A66BFF33', marginBottom: Space.sm },
});
