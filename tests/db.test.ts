import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import { BENEFITS, CONTENT_VERSION, ITEMS, SYNERGIES } from '../src/data/seed';
import type { Db } from '../src/db/client';
import {
  addToStack,
  getFeatured,
  getInsight,
  getStackIds,
  removeFromStack,
  searchItems,
} from '../src/db/repository';
import { migrate } from '../src/db/schema';
import { openTestDb } from './node-db';

describe('seed content', () => {
  const benefitIds = new Set(BENEFITS.map((b) => b.id));
  const itemIds = new Set(ITEMS.map((i) => i.id));

  test('ids are unique', () => {
    assert.equal(benefitIds.size, BENEFITS.length);
    assert.equal(itemIds.size, ITEMS.length);
  });

  test('every item links to known benefits and lists its primary benefit', () => {
    for (const item of ITEMS) {
      assert.ok(benefitIds.has(item.primaryBenefitId), item.id);
      assert.ok(item.benefits.some((b) => b.benefitId === item.primaryBenefitId), `${item.id} missing primary link`);
      for (const b of item.benefits) assert.ok(benefitIds.has(b.benefitId), `${item.id} → ${b.benefitId}`);
    }
  });

  test('synergies reference shipped items', () => {
    for (const s of SYNERGIES) {
      assert.ok(itemIds.has(s.itemId), s.itemId);
      assert.ok(itemIds.has(s.partnerId), s.partnerId);
      assert.notEqual(s.itemId, s.partnerId);
    }
  });

  test('claims avoid cure language', () => {
    for (const item of ITEMS) {
      for (const text of [item.heroTitle, item.heroTarget, item.science]) {
        assert.doesNotMatch(text, /\bcures?\b|\bguarantee/i, `${item.id}: ${text}`);
      }
    }
  });
});

describe('database', () => {
  let db: Db;

  beforeEach(async () => {
    db = openTestDb();
    await migrate(db);
  });

  test('migrate seeds content and sets the version', async () => {
    const count = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM items');
    assert.equal(count?.n, ITEMS.length);
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    assert.equal(v?.user_version, CONTENT_VERSION);
  });

  test('a content update reseeds but keeps the user stack', async () => {
    await addToStack(db, 'turmeric');
    await db.execAsync('PRAGMA user_version = 0');
    await migrate(db);
    assert.deepEqual(await getStackIds(db), ['turmeric']);
    const count = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM items');
    assert.equal(count?.n, ITEMS.length);
  });

  test('stack add is idempotent and remove works', async () => {
    await addToStack(db, 'berberine');
    await addToStack(db, 'berberine');
    await addToStack(db, 'nmn');
    assert.deepEqual(await getStackIds(db), ['berberine', 'nmn']);
    await removeFromStack(db, 'berberine');
    assert.deepEqual(await getStackIds(db), ['nmn']);
  });

  test('turmeric insight shows the piperine power stack', async () => {
    const insight = await getInsight(db, 'turmeric');
    assert.ok(insight);
    assert.equal(insight.item.category, 'protection');
    const pepper = insight.stacks.find((s) => s.partner.id === 'black-pepper');
    assert.ok(pepper);
    assert.match(pepper.boost, /2,000%/);
  });

  test('synergies are symmetric', async () => {
    const insight = await getInsight(db, 'black-pepper');
    assert.ok(insight?.stacks.some((s) => s.partner.id === 'turmeric'));
  });

  test('alternatives exclude the item and fill to at least four', async () => {
    for (const item of ITEMS) {
      const insight = await getInsight(db, item.id);
      assert.ok(insight, item.id);
      assert.ok(!insight.alternatives.some((a) => a.id === item.id), item.id);
      assert.ok(insight.alternatives.length >= 4, `${item.id} has ${insight.alternatives.length}`);
    }
  });

  test('featured items stay in their category', async () => {
    for (const c of ['metabolic', 'longevity', 'protection'] as const) {
      const items = await getFeatured(db, c);
      assert.ok(items.length > 0);
      assert.ok(items.every((i) => i.category === c));
    }
  });
});

describe('search', () => {
  const cases: [query: string, expectedTop: string[]][] = [
    ['turmeric', ['turmeric']],
    ['curcumin', ['turmeric']],
    ['Burn belly fat', ['berberine', 'green-tea', 'cayenne', 'coffee']],
    ['trigger autophagy', ['spermidine']],
    ['boost NAD+', ['nmn']],
    ['lower blood sugar', ['berberine']],
    ['joint pain', ['turmeric']],
    ['detox my liver', ['milk-thistle', 'nac']],
    ['stress and cortisol', ['ashwagandha']],
    ['zombie cells', ['fisetin']],
    ['matcha', ['green-tea']],
  ];

  for (const fts of [true, false]) {
    describe(fts ? 'with FTS5' : 'with LIKE fallback', () => {
      let db: Db;
      beforeEach(async () => {
        db = openTestDb();
        await migrate(db);
        if (!fts) await db.runAsync(`UPDATE meta SET value = '0' WHERE key = 'fts'`);
      });

      for (const [query, expected] of cases) {
        test(`"${query}" → ${expected.join(' | ')}`, async () => {
          const results = await searchItems(db, query);
          assert.ok(results.length > 0, 'no results');
          assert.ok(expected.includes(results[0].id), `got ${results.slice(0, 5).map((r) => r.id).join(', ')}`);
        });
      }

      test('benefit queries report the matched benefit', async () => {
        const [top] = await searchItems(db, 'trigger autophagy');
        assert.equal(top.matchedBenefit, 'Autophagy');
      });

      test('empty and stopword-only queries return nothing', async () => {
        assert.deepEqual(await searchItems(db, ''), []);
        assert.deepEqual(await searchItems(db, 'how to the'), []);
      });

      test('FTS syntax characters are harmless', async () => {
        await searchItems(db, '"turmeric" OR (NEAR* -');
      });
    });
  }
});

test('goal searches stay on-topic', async () => {
  const db = openTestDb();
  await migrate(db);
  const results = await searchItems(db, 'burn belly fat');
  assert.ok(results.every((r) => r.category === 'metabolic' || r.matchedBenefit), 'off-topic result');
  assert.ok(!results.some((r) => r.id === 'ashwagandha'));
});
