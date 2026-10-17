import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import type { Category, Evidence, ItemKind } from '@/data/types';
import { CategoryThemes, Palette, Radius, Space, Type, glow } from '@/theme/tokens';

const EVIDENCE_COPY: Record<Evidence, { label: string; color: string }> = {
  A: { label: 'Strong human evidence', color: '#5CF2B6' },
  B: { label: 'Early human evidence', color: '#FFC861' },
  C: { label: 'Lab & animal evidence', color: '#9AA3B8' },
};

/** Evidence grade chip. Shown next to every claim so users can calibrate trust. */
export function EvidenceBadge({ grade, compact = false }: { grade: Evidence; compact?: boolean }) {
  const { label, color } = EVIDENCE_COPY[grade];
  return (
    <View
      style={[styles.evidence, { borderColor: `${color}55` }]}
      accessibilityLabel={`Evidence grade ${grade}: ${label}`}>
      <View style={[styles.evidenceDot, { backgroundColor: color }, glow(color, 6, 0.9)]} />
      <Text style={[Type.caption, { color }]}>
        {compact ? `Grade ${grade}` : `${grade} · ${label}`}
      </Text>
    </View>
  );
}

/** The glowing hero headline pill, e.g. "Top Natural AMPK Activator". */
export function PowerBadge({ title, category }: { title: string; category: Category }) {
  const theme = CategoryThemes[category];
  return (
    <View style={[styles.powerWrap, glow(theme.accent, 28, 0.6)]}>
      <LinearGradient
        colors={theme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.power}>
        <Text style={styles.powerSpark}>✦</Text>
        <Text style={styles.powerText} numberOfLines={2}>
          {title}
        </Text>
      </LinearGradient>
    </View>
  );
}

export function CategoryChip({ category }: { category: Category }) {
  const theme = CategoryThemes[category];
  return (
    <View style={[styles.chip, { backgroundColor: theme.tint, borderColor: `${theme.accent}55` }]}>
      <View style={[styles.chipDot, { backgroundColor: theme.accent }, glow(theme.accent, 8, 0.9)]} />
      <Text style={[Type.overline, { color: theme.onTint }]}>{theme.label}</Text>
    </View>
  );
}

const KIND_LABEL: Record<ItemKind, string> = {
  food: 'Food',
  herb: 'Herb',
  spice: 'Spice',
  supplement: 'Supplement',
};

export function KindChip({ kind }: { kind: ItemKind }) {
  return (
    <View style={[styles.chip, { backgroundColor: Palette.glass, borderColor: Palette.hairline }]}>
      <Text style={[Type.overline, { color: Palette.textMuted }]}>{KIND_LABEL[kind]}</Text>
    </View>
  );
}

/** Glowing monogram orb standing in for item imagery until we ship photography. */
export function ItemOrb({ name, category, size = 56 }: { name: string; category: Category; size?: number }) {
  const theme = CategoryThemes[category];
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2 }, glow(theme.accent, size / 3, 0.5)]}>
      <LinearGradient
        colors={[`${theme.gradient[0]}`, `${theme.gradient[1]}AA`, '#05060A']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.orb, { borderRadius: size / 2 }]}>
        <Text style={[styles.orbText, { fontSize: size * 0.4 }]}>{name.charAt(0)}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  evidence: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Space.xs + 2,
    paddingHorizontal: Space.sm + 2,
    paddingVertical: Space.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  evidenceDot: { width: 6, height: 6, borderRadius: 3 },
  powerWrap: { borderRadius: Radius.md, alignSelf: 'flex-start', maxWidth: '100%' },
  power: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm + 2,
    borderRadius: Radius.md,
  },
  powerSpark: { color: '#140A00', fontSize: 14, fontWeight: '900' },
  powerText: { ...Type.bodyStrong, color: '#0B0603', fontWeight: '800', flexShrink: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Space.xs + 2,
    paddingHorizontal: Space.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  orb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  orbText: { color: '#FFFFFF', fontWeight: '800', letterSpacing: -0.5 },
});
