import { BENEFITS, CONTENT_VERSION, ITEMS, SYNERGIES } from '@/data/seed';

import type { Db } from './client';

/** Tables that hold bundled content. Dropped and rebuilt when CONTENT_VERSION changes. */
const CONTENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS benefits (
  id        TEXT PRIMARY KEY,
  label     TEXT NOT NULL,
  category  TEXT NOT NULL CHECK (category IN ('metabolic','longevity','protection')),
  keywords  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('food','herb','spice','supplement')),
  aliases            TEXT NOT NULL,
  primary_benefit_id TEXT NOT NULL REFERENCES benefits(id),
  hero_title         TEXT NOT NULL,
  hero_target        TEXT NOT NULL,
  science            TEXT NOT NULL,
  compound           TEXT,
  evidence           TEXT NOT NULL CHECK (evidence IN ('A','B','C')),
  cautions           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_benefits (
  item_id    TEXT NOT NULL REFERENCES items(id),
  benefit_id TEXT NOT NULL REFERENCES benefits(id),
  strength   INTEGER NOT NULL CHECK (strength BETWEEN 1 AND 3),
  evidence   TEXT NOT NULL CHECK (evidence IN ('A','B','C')),
  PRIMARY KEY (item_id, benefit_id)
);
CREATE INDEX IF NOT EXISTS idx_item_benefits_benefit ON item_benefits(benefit_id, strength DESC);

CREATE TABLE IF NOT EXISTS synergies (
  item_id    TEXT NOT NULL REFERENCES items(id),
  partner_id TEXT NOT NULL REFERENCES items(id),
  boost      TEXT NOT NULL,
  mechanism  TEXT NOT NULL,
  evidence   TEXT NOT NULL CHECK (evidence IN ('A','B','C')),
  PRIMARY KEY (item_id, partner_id)
);
`;

/** Full-text index for benefit / symptom search. Column order matters for bm25 weights. */
const FTS_SCHEMA = `
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  item_id UNINDEXED,
  name,
  aliases,
  hero,
  benefit_labels,
  keywords,
  tokenize = 'porter unicode61 remove_diacritics 2'
);
`;

/** User data. Never dropped by a content update. */
const USER_SCHEMA = `
CREATE TABLE IF NOT EXISTS user_stack (
  item_id   TEXT PRIMARY KEY,
  added_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const DROP_CONTENT = `
DROP TABLE IF EXISTS search_index;
DROP TABLE IF EXISTS synergies;
DROP TABLE IF EXISTS item_benefits;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS benefits;
`;

/**
 * Creates tables and loads bundled content when the installed content is
 * older than CONTENT_VERSION. Safe to call on every launch.
 */
export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(USER_SCHEMA);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= CONTENT_VERSION) return;

  await db.withTransactionAsync(async () => {
    await db.execAsync(DROP_CONTENT);
    await db.execAsync(CONTENT_SCHEMA);
    const fts = await tryCreateFts(db);
    await seed(db, fts);
    await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'fts', fts ? '1' : '0');
    // Remove stack entries whose item no longer ships.
    await db.execAsync('DELETE FROM user_stack WHERE item_id NOT IN (SELECT id FROM items);');
  });
  await db.execAsync(`PRAGMA user_version = ${CONTENT_VERSION}`);
}

/** Some builds (notably the default web wa-sqlite) ship without FTS5; search falls back to LIKE. */
async function tryCreateFts(db: Db): Promise<boolean> {
  try {
    await db.execAsync(FTS_SCHEMA);
    return true;
  } catch {
    return false;
  }
}

async function seed(db: Db, fts: boolean): Promise<void> {
  const benefitsById = new Map(BENEFITS.map((b) => [b.id, b]));

  for (const b of BENEFITS) {
    await db.runAsync(
      'INSERT INTO benefits (id, label, category, keywords) VALUES (?, ?, ?, ?)',
      b.id,
      b.label,
      b.category,
      b.keywords.join(' | ')
    );
  }

  for (const item of ITEMS) {
    await db.runAsync(
      `INSERT INTO items (id, name, kind, aliases, primary_benefit_id, hero_title, hero_target, science, compound, evidence, cautions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      item.name,
      item.kind,
      JSON.stringify(item.aliases),
      item.primaryBenefitId,
      item.heroTitle,
      item.heroTarget,
      item.science,
      item.compound ?? null,
      item.evidence,
      JSON.stringify(item.cautions)
    );
    for (const link of item.benefits) {
      await db.runAsync(
        'INSERT INTO item_benefits (item_id, benefit_id, strength, evidence) VALUES (?, ?, ?, ?)',
        item.id,
        link.benefitId,
        link.strength,
        link.evidence
      );
    }

    if (fts) {
      const linked = item.benefits.map((l) => benefitsById.get(l.benefitId)!);
      await db.runAsync(
        'INSERT INTO search_index (item_id, name, aliases, hero, benefit_labels, keywords) VALUES (?, ?, ?, ?, ?, ?)',
        item.id,
        item.name,
        item.aliases.join(' '),
        `${item.heroTitle} ${item.heroTarget} ${item.compound ?? ''}`,
        linked.map((b) => b.label).join(' '),
        linked.flatMap((b) => b.keywords).join(' ')
      );
    }
  }

  for (const s of SYNERGIES) {
    await db.runAsync(
      'INSERT INTO synergies (item_id, partner_id, boost, mechanism, evidence) VALUES (?, ?, ?, ?, ?)',
      s.itemId,
      s.partnerId,
      s.boost,
      s.mechanism,
      s.evidence
    );
  }
}
