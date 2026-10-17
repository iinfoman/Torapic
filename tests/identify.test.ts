import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import type { Db } from '../src/db/client';
import { getItem } from '../src/db/repository';
import { migrate } from '../src/db/schema';
import type { Classification, VisionClassifier } from '../src/vision/classifier';
import { identify } from '../src/vision/identify';
import { openTestDb } from './node-db';

const returning = (matches: Classification[]): VisionClassifier => ({ classify: async () => matches });

describe('identify', () => {
  let db: Db;
  const lookup = (id: string) => getItem(db, id);
  const capture = async () => 'file:///photo.jpg';

  beforeEach(async () => {
    db = openTestDb();
    await migrate(db);
  });

  test('locks onto the most confident match', async () => {
    const outcome = await identify({
      capture,
      lookup,
      classifier: returning([
        { itemId: 'ginger', confidence: 0.7 },
        { itemId: 'turmeric', confidence: 0.9 },
      ]),
    });
    assert.equal(outcome.kind, 'locked');
    assert.equal(outcome.kind === 'locked' && outcome.item.id, 'turmeric');
  });

  test('rejects matches below the confidence floor', async () => {
    const outcome = await identify({ capture, lookup, classifier: returning([{ itemId: 'turmeric', confidence: 0.3 }]) });
    assert.deepEqual(outcome, { kind: 'miss', reason: 'low-confidence' });
  });

  test('falls through labels the library does not ship', async () => {
    const outcome = await identify({
      capture,
      lookup,
      classifier: returning([
        { itemId: 'dragonfruit', confidence: 0.95 },
        { itemId: 'garlic', confidence: 0.8 },
      ]),
    });
    assert.equal(outcome.kind === 'locked' && outcome.item.id, 'garlic');
  });

  test('reports unknown labels when nothing confident is in the library', async () => {
    const outcome = await identify({ capture, lookup, classifier: returning([{ itemId: 'dragonfruit', confidence: 0.95 }]) });
    assert.deepEqual(outcome, { kind: 'miss', reason: 'not-in-library' });
  });

  test('turns capture and classifier failures into misses', async () => {
    const noPhoto = await identify({ capture: async () => undefined, lookup, classifier: returning([]) });
    assert.deepEqual(noPhoto, { kind: 'miss', reason: 'capture-failed' });

    const cameraThrows = await identify({
      capture: async () => {
        throw new Error('camera busy');
      },
      lookup,
      classifier: returning([]),
    });
    assert.deepEqual(cameraThrows, { kind: 'miss', reason: 'capture-failed' });

    const modelThrows = await identify({
      capture,
      lookup,
      classifier: {
        classify: async () => {
          throw new Error('model failed');
        },
      },
    });
    assert.deepEqual(modelThrows, { kind: 'miss', reason: 'low-confidence' });
  });
});
