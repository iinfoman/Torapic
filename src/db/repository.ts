import type {
  Benefit,
  Category,
  Evidence,
  Insight,
  ItemKind,
  ItemRecord,
  PowerStack,
  SearchResult,
} from '@/data/types';

import type { Db } from './client';

type ItemRow = {
  id: string;
  name: string;
  kind: ItemKind;
  aliases: string;
  primary_benefit_id: string;
  hero_title: string;
  hero_target: string;
  science: string;
  compound: string | null;
  evidence: Evidence;
  cautions: string;
  category: Category;
  primary_benefit_label: string;
};

const ITEM_SELECT = `
SELECT i.*, b.category AS category, b.label AS primary_benefit_label
FROM items i JOIN benefits b ON b.id = i.primary_benefit_id`;

const EVIDENCE_WEIGHT: Record<Evidence, number> = { A: 1, B: 0.8, C: 0.55 };
const TEXT_WEIGHT = 6;
const EVIDENCE_ORDER = `CASE evidence WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END`;

function toRecord(row: ItemRow): ItemRecord {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    aliases: JSON.parse(row.aliases),
    primaryBenefitId: row.primary_benefit_id,
    primaryBenefitLabel: row.primary_benefit_label,
    heroTitle: row.hero_title,
    heroTarget: row.hero_target,
    science: row.science,
    compound: row.compound ?? undefined,
    evidence: row.evidence,
    cautions: JSON.parse(row.cautions),
    category: row.category,
  };
}

// ───────────── Benefits ─────────────

const benefitCache = new WeakMap<Db, Promise<Benefit[]>>();

export function getBenefits(db: Db): Promise<Benefit[]> {
  let cached = benefitCache.get(db);
  if (!cached) {
    cached = db
      .getAllAsync<{ id: string; label: string; category: Category; keywords: string }>('SELECT * FROM benefits')
      .then((rows) => rows.map((r) => ({ ...r, keywords: r.keywords.split(' | ') })));
    benefitCache.set(db, cached);
  }
  return cached;
}

// ───────────── Items ─────────────

export async function getItem(db: Db, id: string): Promise<ItemRecord | null> {
  const row = await db.getFirstAsync<ItemRow>(`${ITEM_SELECT} WHERE i.id = ?`, id);
  return row ? toRecord(row) : null;
}

async function getItems(db: Db, ids: string[]): Promise<Map<string, ItemRecord>> {
  if (ids.length === 0) return new Map();
  const rows = await db.getAllAsync<ItemRow>(
    `${ITEM_SELECT} WHERE i.id IN (${ids.map(() => '?').join(',')})`,
    ...ids
  );
  return new Map(rows.map((r) => [r.id, toRecord(r)]));
}

/** Signature items per category, for the Discover screen before the user types. */
export async function getFeatured(db: Db, category: Category, limit = 8): Promise<ItemRecord[]> {
  const rows = await db.getAllAsync<ItemRow>(
    `${ITEM_SELECT}
     JOIN item_benefits ib ON ib.item_id = i.id AND ib.benefit_id = i.primary_benefit_id
     WHERE b.category = ?
     ORDER BY ib.strength DESC, CASE i.evidence WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END, i.name
     LIMIT ?`,
    category,
    limit
  );
  return rows.map(toRecord);
}

/** Everything the Hero Insight Card needs, in one call. */
export async function getInsight(db: Db, id: string): Promise<Insight | null> {
  const item = await getItem(db, id);
  if (!item) return null;

  const benefitRows = await db.getAllAsync<{ benefit_id: string; strength: number; evidence: Evidence }>(
    `SELECT benefit_id, strength, evidence FROM item_benefits WHERE item_id = ?
     ORDER BY strength DESC, ${EVIDENCE_ORDER}`,
    id
  );
  const allBenefits = new Map((await getBenefits(db)).map((b) => [b.id, b]));
  const benefits = benefitRows.map((r) => ({ ...allBenefits.get(r.benefit_id)!, strength: r.strength, evidence: r.evidence }));

  // Synergies are symmetric: scanning black pepper should still surface its turmeric pairing.
  const synergyRows = await db.getAllAsync<{
    item_id: string;
    partner_id: string;
    boost: string;
    mechanism: string;
    evidence: Evidence;
  }>(`SELECT * FROM synergies WHERE item_id = ? OR partner_id = ? ORDER BY ${EVIDENCE_ORDER}`, id, id);
  const partnerIds = synergyRows.map((s) => (s.item_id === id ? s.partner_id : s.item_id));
  const partners = await getItems(db, partnerIds);
  const stacks: PowerStack[] = synergyRows.map((s, i) => ({
    partner: partners.get(partnerIds[i])!,
    boost: s.boost,
    mechanism: s.mechanism,
    evidence: s.evidence,
  }));

  return { item, benefits, stacks, alternatives: await getAlternatives(db, item) };
}

/**
 * Same-class alternatives: other items that share this item's primary benefit,
 * strongest first. Topped up from the same category if the class is small.
 */
export async function getAlternatives(db: Db, item: ItemRecord, limit = 8): Promise<ItemRecord[]> {
  const sameClass = await db.getAllAsync<ItemRow>(
    `${ITEM_SELECT}
     JOIN item_benefits ib ON ib.item_id = i.id
     WHERE ib.benefit_id = ? AND i.id != ?
     ORDER BY ib.strength DESC, CASE ib.evidence WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END, i.name
     LIMIT ?`,
    item.primaryBenefitId,
    item.id,
    limit
  );
  const results = sameClass.map(toRecord);
  if (results.length >= 4) return results;

  const seen = new Set([item.id, ...results.map((r) => r.id)]);
  const sameCategory = await getFeatured(db, item.category, limit + seen.size);
  for (const r of sameCategory) {
    if (results.length >= limit) break;
    if (!seen.has(r.id)) results.push(r);
  }
  return results;
}

// ───────────── Search ─────────────

const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'my', 'to', 'for', 'of', 'in', 'on', 'with', 'how', 'what', 'is', 'i', 'me',
  'can', 'help', 'best', 'natural', 'naturally', 'foods', 'food', 'want', 'get', 'reduce', 'improve',
  'boost', 'increase', 'support', 'more', 'less',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

/**
 * How well each benefit matches the query, 0..1. A keyword phrase fully
 * present in the query scores 1; partial phrase overlap scores proportionally.
 * Benefits that explain more of the query rank higher, so "detox my liver"
 * prefers Liver support over the broader Antioxidant defense.
 */
export function scoreBenefits(benefits: Benefit[], query: string): Map<string, number> {
  const queryTokens = tokenize(query);
  const scores = new Map<string, number>();
  for (const b of benefits) {
    let best = 0;
    const covered = new Set<string>();
    for (const phrase of [b.label, ...b.keywords]) {
      const phraseTokens = tokenize(phrase);
      if (phraseTokens.length === 0) continue;
      const hits = phraseTokens.filter((p) => queryTokens.some((q) => tokensMatch(p, q))).length;
      best = Math.max(best, hits / phraseTokens.length);
      for (const q of queryTokens) if (phraseTokens.some((p) => tokensMatch(p, q))) covered.add(q);
    }
    const coverage = covered.size / queryTokens.length;
    if (best >= 0.5) scores.set(b.id, best * (0.5 + 0.5 * coverage));
  }
  return scores;
}

async function hasFts(db: Db): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM meta WHERE key = 'fts'`);
  return row?.value === '1';
}

/** Text relevance per item, normalized to 0..TEXT_WEIGHT. Benefit strength, not wording, should decide close calls. */
async function textScores(db: Db, tokens: string[]): Promise<Map<string, number>> {
  let rows: { item_id: string; s: number }[];
  if (await hasFts(db)) {
    const match = tokens.map((t) => `"${t}"*`).join(' OR ');
    // Column weights: item_id, name, aliases, hero, benefit_labels, keywords.
    rows = await db.getAllAsync(
      `SELECT item_id, -bm25(search_index, 0, 10, 8, 3, 4, 2) AS s
       FROM search_index WHERE search_index MATCH ? ORDER BY s DESC LIMIT 100`,
      match
    );
  } else {
    // Without FTS, substring matches on prose are too noisy; match names only and let benefits rank.
    const terms = tokens.map(() => `(lower(i.name) LIKE ?) * 10 + (lower(i.aliases) LIKE ?) * 8`);
    const params = tokens.flatMap((t) => [`%${t}%`, `%${t}%`]);
    rows = await db.getAllAsync(
      `SELECT item_id, s FROM (SELECT i.id AS item_id, ${terms.join(' + ')} AS s FROM items i) WHERE s > 0`,
      ...params
    );
  }
  const max = Math.max(0, ...rows.map((r) => r.s));
  return new Map(rows.map((r) => [r.item_id, max > 0 ? (r.s / max) * TEXT_WEIGHT : 0]));
}

/**
 * Ranks items for a free-text query: an item name ("turmeric"), a goal
 * ("burn belly fat") or a symptom ("joint pain"). Fully offline.
 */
export async function searchItems(db: Db, query: string, limit = 20): Promise<SearchResult[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const benefits = await getBenefits(db);
  const benefitScores = scoreBenefits(benefits, query);
  const benefitLabels = new Map(benefits.map((b) => [b.id, b.label]));

  const scores = await textScores(db, tokens);
  const matchedBenefit = new Map<string, { id: string; score: number }>();

  if (benefitScores.size > 0) {
    const ids = [...benefitScores.keys()];
    const links = await db.getAllAsync<{ item_id: string; benefit_id: string; strength: number; evidence: Evidence }>(
      `SELECT * FROM item_benefits WHERE benefit_id IN (${ids.map(() => '?').join(',')})`,
      ...ids
    );
    for (const l of links) {
      const s = benefitScores.get(l.benefit_id)! * l.strength * EVIDENCE_WEIGHT[l.evidence] * 4;
      scores.set(l.item_id, (scores.get(l.item_id) ?? 0) + s);
      const prev = matchedBenefit.get(l.item_id);
      if (!prev || s > prev.score) matchedBenefit.set(l.item_id, { id: l.benefit_id, score: s });
    }
  }

  // When the query names a goal, incidental word hits ("fat" in "fat-soluble") are noise.
  const minText = matchedBenefit.size > 0 ? TEXT_WEIGHT * 0.4 : 0;
  const ranked = [...scores.entries()]
    .filter(([id, score]) => matchedBenefit.has(id) || score >= minText)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const records = await getItems(db, ranked.map(([id]) => id));
  const normalized = tokens.join(' ');

  return ranked
    .map(([id, score]) => {
      const item = records.get(id)!;
      const names = [item.name, ...item.aliases].map((n) => tokenize(n).join(' '));
      const exact = names.includes(normalized) ? 20 : 0;
      const benefit = matchedBenefit.get(id);
      return {
        ...item,
        score: score + exact,
        matchedBenefit: benefit ? benefitLabels.get(benefit.id) : undefined,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ───────────── Daily stack ─────────────

export async function getStack(db: Db): Promise<ItemRecord[]> {
  const rows = await db.getAllAsync<ItemRow>(
    `${ITEM_SELECT} JOIN user_stack s ON s.item_id = i.id ORDER BY s.added_at`
  );
  return rows.map(toRecord);
}

export async function getStackIds(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ item_id: string }>('SELECT item_id FROM user_stack ORDER BY added_at');
  return rows.map((r) => r.item_id);
}

export async function addToStack(db: Db, itemId: string): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO user_stack (item_id, added_at) VALUES (?, ?)', itemId, Date.now());
}

export async function removeFromStack(db: Db, itemId: string): Promise<void> {
  await db.runAsync('DELETE FROM user_stack WHERE item_id = ?', itemId);
}
