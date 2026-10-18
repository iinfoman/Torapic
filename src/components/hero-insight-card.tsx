import { Link } from 'expo-router';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { Insight, PowerStack } from '@/data/types';
import { CategoryThemes, Palette, Radius, Space, Type, glow } from '@/theme/tokens';

import { CategoryChip, EvidenceBadge, ItemOrb, KindChip, PowerBadge } from './badges';
import { Glass } from './glass';
import { ItemTile } from './item-tile';
import { StackButton } from './stack-button';

const enter = (i: number) => FadeInDown.delay(80 + i * 70).springify().damping(18).stiffness(140);

/**
 * The Hero Insight Card: an item's single strongest benefit, what it targets,
 * one line of science, its Power Stack partners, and same-class alternatives.
 */
export function HeroInsightCard({ insight }: { insight: Insight }) {
  const { item, benefits, stacks, alternatives } = insight;
  const theme = CategoryThemes[item.category];

  return (
    <View style={styles.root}>
      <Animated.View entering={enter(0)}>
        <Glass category={item.category} style={[styles.hero, glow(theme.accent, 40, 0.22)]} intensity={40}>
          <View style={styles.heroTop}>
            <ItemOrb name={item.name} category={item.category} size={64} />
            <View style={styles.heroChips}>
              <KindChip kind={item.kind} />
              <CategoryChip category={item.category} />
            </View>
          </View>

          <Text style={[Type.display, styles.name]}>{item.name}</Text>
          {item.compound ? (
            <Text style={[Type.caption, { color: Palette.textFaint }]}>Active: {item.compound}</Text>
          ) : null}

          <View style={styles.badgeRow}>
            <PowerBadge title={item.heroTitle} category={item.category} />
          </View>

          <Text style={[Type.heading, { color: theme.onTint }]}>{item.heroTarget}</Text>

          <View style={[styles.science, { borderLeftColor: theme.accent }]}>
            <Text style={[Type.overline, { color: Palette.textFaint }]}>The science, simply</Text>
            <Text style={[Type.body, { color: Palette.textMuted }]}>{item.science}</Text>
            <EvidenceBadge grade={item.evidence} />
          </View>

          <StackButton itemId={item.id} category={item.category} />
        </Glass>
      </Animated.View>

      {stacks.length > 0 ? (
        <Animated.View entering={enter(1)} style={styles.section}>
          <SectionHeader title="Power Stack" subtitle="Pair it to unlock more" />
          {stacks.map((s) => (
            <PowerStackCard key={s.partner.id} stack={s} />
          ))}
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(2)} style={styles.section}>
        <SectionHeader title="Also benefits" />
        <View style={styles.benefitWrap}>
          {benefits.map((b) => {
            const t = CategoryThemes[b.category];
            return (
              <View key={b.id} style={[styles.benefitPill, { backgroundColor: t.tint, borderColor: `${t.accent}40` }]}>
                <Text style={[Type.caption, { color: t.onTint }]}>{b.label}</Text>
                <Text style={[Type.caption, { color: Palette.textFaint }]}>
                  {'●'.repeat(b.strength)}
                  {'○'.repeat(3 - b.strength)} · {b.evidence}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {alternatives.length > 0 ? (
        <Animated.View entering={enter(3)} style={styles.section}>
          <SectionHeader title="Same-Class Alternatives" subtitle={item.primaryBenefitLabel} />
          <FlatList
            data={alternatives}
            horizontal
            keyExtractor={(a) => a.id}
            renderItem={({ item: alt }) => <ItemTile item={alt} />}
            showsHorizontalScrollIndicator={false}
            snapToInterval={168 + Space.md}
            decelerationRate="fast"
            contentContainerStyle={styles.carousel}
            style={styles.carouselBleed}
          />
        </Animated.View>
      ) : null}

      {item.cautions.length > 0 ? (
        <Animated.View entering={enter(4)} style={styles.section}>
          <SectionHeader title="Before you take it" />
          <Glass style={styles.cautions}>
            {item.cautions.map((c) => (
              <View key={c} style={styles.cautionRow}>
                <Text style={[Type.body, { color: Palette.warning }]}>!</Text>
                <Text style={[Type.body, styles.cautionText]}>{c}</Text>
              </View>
            ))}
          </Glass>
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(5)} style={styles.section}>
        <Pressable
          accessibilityRole="button"
          onPress={() => notify('Certified brands', BRANDS_COMING_SOON)}
          style={({ pressed }) => [styles.shop, pressed && { opacity: 0.8 }]}>
          <Text style={[Type.bodyStrong, { color: Palette.text }]}>Find Certified High-Potency Brands</Text>
          <Text style={[Type.caption, { color: Palette.textFaint }]}>Third-party tested · near you</Text>
        </Pressable>
        <Text style={[Type.caption, styles.disclaimer]}>
          Educational information, not medical advice. Talk to your doctor or pharmacist before starting a supplement,
          especially if you are pregnant or take medication.
        </Text>
      </Animated.View>
    </View>
  );
}

const BRANDS_COMING_SOON =
  'Verified stockists and third-party-tested brands will appear here once cloud sync is live.';

/** Alert.alert is a no-op on web, so fall back to the browser dialog there. */
function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[Type.title, { color: Palette.text }]}>{title}</Text>
      {subtitle ? <Text style={[Type.caption, { color: Palette.textFaint }]}>{subtitle}</Text> : null}
    </View>
  );
}

function PowerStackCard({ stack }: { stack: PowerStack }) {
  const theme = CategoryThemes[stack.partner.category];
  return (
    <Link href={{ pathname: '/item/[id]', params: { id: stack.partner.id } }} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <Glass category={stack.partner.category} style={styles.stack}>
          <View style={styles.stackTop}>
            <Text style={[Type.title, styles.plus, { color: theme.accent, textShadowColor: theme.accent }]}>+</Text>
            <ItemOrb name={stack.partner.name} category={stack.partner.category} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[Type.heading, { color: Palette.text }]}>{stack.partner.name}</Text>
              <Text style={[Type.bodyStrong, { color: theme.onTint }]}>{stack.boost}</Text>
            </View>
          </View>
          <Text style={[Type.body, { color: Palette.textMuted }]}>{stack.mechanism}</Text>
          <EvidenceBadge grade={stack.evidence} />
        </Glass>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { gap: Space.xxl },
  hero: { padding: Space.xl, gap: Space.lg, borderRadius: Radius.xl },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroChips: { alignItems: 'flex-end', gap: Space.sm, flexShrink: 1 },
  name: { color: Palette.text, marginTop: Space.xs },
  badgeRow: { flexDirection: 'row' },
  science: { borderLeftWidth: 2, paddingLeft: Space.md, gap: Space.sm },
  section: { gap: Space.md },
  sectionHeader: { gap: 2 },
  benefitWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  benefitPill: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 2,
  },
  carousel: { gap: Space.md, paddingHorizontal: Space.lg },
  carouselBleed: { marginHorizontal: -Space.lg },
  stack: { padding: Space.lg, gap: Space.md },
  stackTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  plus: { width: 20, textAlign: 'center', textShadowRadius: 10 },
  cautions: { padding: Space.lg, gap: Space.md },
  cautionRow: { flexDirection: 'row', gap: Space.md },
  cautionText: { color: Palette.textMuted, flex: 1 },
  shop: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.hairlineStrong,
    backgroundColor: Palette.glass,
    padding: Space.lg,
    alignItems: 'center',
    gap: 2,
  },
  disclaimer: { color: Palette.textFaint, textAlign: 'center', paddingHorizontal: Space.md },
});
