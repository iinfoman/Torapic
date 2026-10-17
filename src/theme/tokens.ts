import { Platform } from 'react-native';

import type { Category } from '@/data/types';

/** Base surfaces. Torapic is dark-first; every screen sits on `bg`. */
export const Palette = {
  bg: '#05060A',
  bgRaised: '#0B0D14',
  glass: 'rgba(255,255,255,0.06)',
  glassStrong: 'rgba(255,255,255,0.10)',
  hairline: 'rgba(255,255,255,0.09)',
  hairlineStrong: 'rgba(255,255,255,0.16)',
  text: '#F4F5F8',
  textMuted: 'rgba(244,245,248,0.64)',
  textFaint: 'rgba(244,245,248,0.40)',
  danger: '#FF6B6B',
  warning: '#FFC861',
} as const;

export type CategoryTheme = {
  label: string;
  /** Primary accent: badges, glows, active states. */
  accent: string;
  /** Secondary accent: the far end of gradients. */
  accentAlt: string;
  /** Low-alpha accent fill for chips and tinted glass. */
  tint: string;
  /** Text color that reads on top of `tint`. */
  onTint: string;
  gradient: readonly [string, string, string];
};

/**
 * Color psychology per benefit category:
 * - metabolic:  neon amber / electric orange
 * - longevity:  cyber purple / bio-neon violet
 * - protection: emerald / gold
 */
export const CategoryThemes: Record<Category, CategoryTheme> = {
  metabolic: {
    label: 'Metabolic & Fat Burn',
    accent: '#FF9F1C',
    accentAlt: '#FF5E1A',
    tint: 'rgba(255,159,28,0.14)',
    onTint: '#FFC877',
    gradient: ['#FFB547', '#FF7A1A', '#FF4D1A'],
  },
  longevity: {
    label: 'Autophagy & Anti-Aging',
    accent: '#A66BFF',
    accentAlt: '#D84CFF',
    tint: 'rgba(166,107,255,0.16)',
    onTint: '#CDB0FF',
    gradient: ['#C08BFF', '#9A5CFF', '#D84CFF'],
  },
  protection: {
    label: 'Cellular Protection & Detox',
    accent: '#2EE6A0',
    accentAlt: '#E8C25A',
    tint: 'rgba(46,230,160,0.13)',
    onTint: '#8BF5C9',
    gradient: ['#5CF2B6', '#21C98A', '#E8C25A'],
  },
};

/** On web the native tab bar renders at the top of the page; screens pad below it. */
export const WebTabInset = Platform.OS === 'web' ? 72 : 0;

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const Radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;

const sans = Platform.select({ ios: 'System', default: undefined });

export const Type = {
  display: { fontFamily: sans, fontSize: 34, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8 },
  title: { fontFamily: sans, fontSize: 24, lineHeight: 29, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontFamily: sans, fontSize: 18, lineHeight: 23, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontFamily: sans, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontFamily: sans, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontFamily: sans, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  overline: {
    fontFamily: sans,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
} as const;

/** Colored outer glow. `boxShadow` renders on iOS, Android (new arch) and web. */
export function glow(color: string, radius = 24, opacity = 0.55) {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return { boxShadow: `0px 0px ${radius}px 0px ${color}${alpha}` };
}
