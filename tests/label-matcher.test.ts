import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ITEMS } from '../src/data/seed';
import { MIN_CONFIDENCE } from '../src/vision/classifier';
import { matchLabel, type LabelLine } from '../src/vision/label-matcher';

const targets = ITEMS.map((i) => ({ itemId: i.id, name: i.name, aliases: i.aliases }));
const top = (lines: LabelLine[]) => matchLabel(lines, targets)[0];

describe('matchLabel', () => {
  test('reads the product name off a supplement bottle', () => {
    const result = top([
      { text: 'NATURE’S BEST', height: 18 },
      { text: 'BERBERINE HCl', height: 64 },
      { text: '500 mg · 60 Vegetarian Capsules', height: 20 },
      { text: 'Supports healthy glucose metabolism*', height: 16 },
    ]);
    assert.equal(result?.itemId, 'berberine');
    assert.ok(result.confidence >= 0.9);
  });

  test('ranks the headline ingredient above co-ingredients', () => {
    const results = matchLabel(
      [
        { text: 'Turmeric Curcumin', height: 60 },
        { text: 'with BioPerine® black pepper extract', height: 24 },
      ],
      targets
    );
    assert.equal(results[0].itemId, 'turmeric');
    assert.ok(results.some((r) => r.itemId === 'black-pepper'));
    assert.ok(results.find((r) => r.itemId === 'black-pepper')!.confidence < results[0].confidence);
  });

  test('matches aliases and multi-word names', () => {
    assert.equal(top([{ text: 'Silymarin Milk Thistle Extract', height: 40 }])?.itemId, 'milk-thistle');
    assert.equal(top([{ text: 'N-Acetyl Cysteine 600mg', height: 40 }])?.itemId, 'nac');
    assert.equal(top([{ text: 'KSM-66 Ashwagandha', height: 40 }])?.itemId, 'ashwagandha');
    assert.equal(top([{ text: 'Organic Matcha', height: 40 }])?.itemId, 'green-tea');
  });

  test('tolerates a single OCR misread in long words', () => {
    assert.equal(top([{ text: 'BERBERlNE', height: 50 }])?.itemId, 'berberine');
    assert.equal(top([{ text: 'Spermldine', height: 50 }])?.itemId, 'spermidine');
  });

  test('does not fuzzy-match short words', () => {
    // "nad" is one letter from "nac" but must not lock NAC.
    assert.equal(matchLabel([{ text: 'NAD booster', height: 50 }], targets).find((r) => r.itemId === 'nac'), undefined);
  });

  test('small print alone stays below the lock threshold', () => {
    const result = top([
      { text: 'PROTEIN CRUNCH BAR', height: 70 },
      { text: 'Ingredients: oats, cinnamon, sea salt', height: 14 },
    ]);
    assert.equal(result?.itemId, 'cinnamon');
    assert.ok(result.confidence < MIN_CONFIDENCE, `confidence ${result.confidence}`);
  });

  test('ignores generic nutrition-panel words', () => {
    assert.deepEqual(matchLabel([{ text: 'Dietary Fiber 3g', height: 60 }], targets), []);
  });

  test('returns nothing for unrelated or empty text', () => {
    assert.deepEqual(matchLabel([{ text: 'Sparkling Water', height: 60 }], targets), []);
    assert.deepEqual(matchLabel([], targets), []);
    assert.deepEqual(matchLabel([{ text: '   ', height: 30 }], targets), []);
  });
});
