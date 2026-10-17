import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlowBackdrop } from '@/components/glass';
import { HeroInsightCard } from '@/components/hero-insight-card';
import { getInsight } from '@/db/repository';
import { useDbQuery } from '@/hooks/use-db-query';
import { Palette, Space, Type } from '@/theme/tokens';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: insight, loading } = useDbQuery((db) => getInsight(db, id), [id]);

  return (
    <View style={styles.screen}>
      <GlowBackdrop category={insight?.item.category} strength={1.2} />
      {insight ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 56 }]}>
          <HeroInsightCard key={insight.item.id} insight={insight} />
        </ScrollView>
      ) : !loading ? (
        <Text style={[Type.body, styles.missing]}>This item isn’t in your offline library yet.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.bg },
  content: { padding: Space.lg, paddingBottom: 64 },
  missing: { color: Palette.textMuted, textAlign: 'center', marginTop: 160 },
});
