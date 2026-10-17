import { useDeferredValue, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glass, GlowBackdrop } from '@/components/glass';
import { ItemRow, ItemTile } from '@/components/item-tile';
import type { Category } from '@/data/types';
import { getFeatured, searchItems } from '@/db/repository';
import { useDbQuery } from '@/hooks/use-db-query';
import { CategoryThemes, Palette, Radius, Space, Type, WebTabInset, glow } from '@/theme/tokens';

const QUICK_GOALS: { label: string; category: Category }[] = [
  { label: 'Burn belly fat', category: 'metabolic' },
  { label: 'Trigger autophagy', category: 'longevity' },
  { label: 'Boost NAD+', category: 'longevity' },
  { label: 'Lower blood sugar', category: 'metabolic' },
  { label: 'Joint pain', category: 'protection' },
  { label: 'Detox my liver', category: 'protection' },
  { label: 'Calm stress', category: 'protection' },
];

const CATEGORIES: Category[] = ['metabolic', 'longevity', 'protection'];

export default function DiscoverScreen() {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());

  return (
    <View style={styles.screen}>
      <GlowBackdrop />
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.header}>
            <Text style={[Type.overline, { color: Palette.textFaint }]}>torapic.ai</Text>
            <Text style={[Type.display, { color: Palette.text }]}>What do you{'\n'}want to unlock?</Text>
          </Animated.View>

          <Glass style={styles.search}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search a food, herb, goal or symptom"
              placeholderTextColor={Palette.textFaint}
              style={[Type.body, styles.input]}
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
              accessibilityLabel="Search"
            />
          </Glass>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.bleed}>
            {QUICK_GOALS.map((g) => {
              const t = CategoryThemes[g.category];
              const active = query.toLowerCase() === g.label.toLowerCase();
              return (
                <Pressable
                  key={g.label}
                  onPress={() => setQuery(active ? '' : g.label)}
                  style={[
                    styles.chip,
                    { borderColor: `${t.accent}55`, backgroundColor: active ? `${t.accent}33` : t.tint },
                    active && glow(t.accent, 14, 0.6),
                  ]}>
                  <Text style={[Type.caption, { color: t.onTint }]}>{g.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {deferred ? <Results query={deferred} /> : <Featured />}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Results({ query }: { query: string }) {
  const { data } = useDbQuery((db) => searchItems(db, query), [query]);
  if (!data) return null;
  if (data.length === 0) {
    return (
      <Text style={[Type.body, styles.empty]}>
        Nothing offline matches “{query}” yet. Try a goal like “inflammation” or an ingredient name.
      </Text>
    );
  }
  return (
    <Animated.View entering={FadeIn} style={styles.results}>
      <Text style={[Type.overline, { color: Palette.textFaint }]}>
        {data.length} ranked by potency · offline
      </Text>
      {data.map((r, i) => (
        <Animated.View key={r.id} entering={FadeInDown.delay(i * 35).springify().damping(18)}>
          <ItemRow item={r} subtitle={r.matchedBenefit ? `Matches: ${r.matchedBenefit}` : undefined} />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

function Featured() {
  return (
    <View style={styles.featured}>
      {CATEGORIES.map((c) => (
        <FeaturedRow key={c} category={c} />
      ))}
    </View>
  );
}

function FeaturedRow({ category }: { category: Category }) {
  const { data } = useDbQuery((db) => getFeatured(db, category), [category]);
  const theme = CategoryThemes[category];
  return (
    <View style={styles.featuredRow}>
      <View style={styles.featuredHeader}>
        <View style={[styles.dot, { backgroundColor: theme.accent }, glow(theme.accent, 10, 0.9)]} />
        <Text style={[Type.heading, { color: Palette.text }]}>{theme.label}</Text>
      </View>
      <FlatList
        data={data ?? []}
        horizontal
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ItemTile item={item} />}
        showsHorizontalScrollIndicator={false}
        snapToInterval={168 + Space.md}
        decelerationRate="fast"
        contentContainerStyle={styles.carousel}
        style={styles.bleed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.bg },
  flex: { flex: 1 },
  content: { padding: Space.lg, paddingBottom: 120, gap: Space.lg },
  header: { gap: Space.sm, marginTop: Space.md + WebTabInset },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    height: 54,
    gap: Space.sm,
  },
  searchIcon: { color: Palette.textMuted, fontSize: 22 },
  input: { flex: 1, color: Palette.text, height: '100%' },
  bleed: { marginHorizontal: -Space.lg },
  chips: { gap: Space.sm, paddingHorizontal: Space.lg },
  chip: { paddingHorizontal: Space.md, paddingVertical: Space.sm, borderRadius: Radius.pill, borderWidth: 1 },
  results: { gap: Space.sm },
  empty: { color: Palette.textMuted, textAlign: 'center', marginTop: Space.xl },
  featured: { gap: Space.xl, marginTop: Space.sm },
  featuredRow: { gap: Space.md },
  featuredHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  carousel: { gap: Space.md, paddingHorizontal: Space.lg },
});
