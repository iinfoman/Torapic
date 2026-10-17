import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ItemRecord } from '@/data/types';
import { CategoryThemes, Palette, Space, Type } from '@/theme/tokens';

import { EvidenceBadge, ItemOrb } from './badges';
import { Glass } from './glass';

/** Compact card used in horizontal carousels (alternatives, featured). */
export function ItemTile({ item, width = 168 }: { item: ItemRecord; width?: number }) {
  const theme = CategoryThemes[item.category];
  return (
    <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
      <Pressable style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1 }]}>
        <Glass category={item.category} style={styles.tile}>
          <ItemOrb name={item.name} category={item.category} size={40} />
          <Text style={[Type.heading, styles.name]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[Type.caption, { color: theme.onTint }]} numberOfLines={2}>
            {item.heroTitle}
          </Text>
          <View style={styles.footer}>
            <EvidenceBadge grade={item.evidence} compact />
          </View>
        </Glass>
      </Pressable>
    </Link>
  );
}

/** Full-width row used for search results and the daily stack. */
export function ItemRow({
  item,
  subtitle,
  trailing,
}: {
  item: ItemRecord;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  const theme = CategoryThemes[item.category];
  return (
    <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <Glass style={styles.row}>
          <ItemOrb name={item.name} category={item.category} size={44} />
          <View style={styles.rowText}>
            <Text style={[Type.bodyStrong, { color: Palette.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[Type.caption, { color: theme.onTint }]} numberOfLines={1}>
              {item.heroTitle}
            </Text>
            {subtitle ? (
              <Text style={[Type.caption, { color: Palette.textFaint }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {trailing ?? <Text style={styles.chevron}>›</Text>}
        </Glass>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  tile: { padding: Space.lg, gap: Space.sm, minHeight: 190 },
  name: { color: Palette.text, marginTop: Space.xs },
  footer: { marginTop: 'auto' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    borderRadius: 20,
  },
  rowText: { flex: 1, gap: 2 },
  chevron: { color: Palette.textFaint, fontSize: 26, fontWeight: '300', paddingHorizontal: Space.xs },
});
