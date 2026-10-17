export type Category = 'metabolic' | 'longevity' | 'protection';

export type ItemKind = 'food' | 'herb' | 'spice' | 'supplement';

/**
 * Strength of the human evidence behind a claim.
 * A = multiple human RCTs or meta-analyses
 * B = small human trials or consistent observational data
 * C = mostly animal / cell studies; early or speculative in humans
 */
export type Evidence = 'A' | 'B' | 'C';

export type Benefit = {
  id: string;
  label: string;
  category: Category;
  /** Plain-language goals and symptoms people type ("burn belly fat"). */
  keywords: string[];
};

export type ItemBenefitLink = {
  benefitId: string;
  /** 1 = minor, 2 = notable, 3 = signature benefit. */
  strength: 1 | 2 | 3;
  evidence: Evidence;
};

export type Item = {
  id: string;
  name: string;
  kind: ItemKind;
  aliases: string[];
  /** Benefit that drives the hero headline, theme color, and same-class alternatives. */
  primaryBenefitId: string;
  /** Hero headline: the item's single strongest bio-active benefit. */
  heroTitle: string;
  /** What that benefit targets, in one line. */
  heroTarget: string;
  /** One-sentence plain-English science. */
  science: string;
  /** Key active compound, if any (e.g. "Curcumin"). */
  compound?: string;
  evidence: Evidence;
  benefits: ItemBenefitLink[];
  cautions: string[];
};

export type Synergy = {
  itemId: string;
  partnerId: string;
  /** Short headline, e.g. "~20× curcumin absorption". */
  boost: string;
  mechanism: string;
  evidence: Evidence;
};

/** An item as read back from the local database, with its category resolved. */
export type ItemRecord = Omit<Item, 'benefits'> & {
  category: Category;
  primaryBenefitLabel: string;
};

export type SearchResult = ItemRecord & {
  /** Benefit that best matched the query, if the match came from a benefit. */
  matchedBenefit?: string;
  score: number;
};

export type PowerStack = {
  partner: ItemRecord;
  boost: string;
  mechanism: string;
  evidence: Evidence;
};

export type Insight = {
  item: ItemRecord;
  benefits: (Benefit & { strength: number; evidence: Evidence })[];
  stacks: PowerStack[];
  alternatives: ItemRecord[];
};
