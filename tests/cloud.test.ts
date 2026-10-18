import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { handleIdentify } from '../server/handler';
import { DEFAULT_MODEL, identifyPhoto, type MessagesClient } from '../server/identify';
import { getItem } from '../src/db/repository';
import { migrate } from '../src/db/schema';
import type { Classification, VisionClassifier } from '../src/vision/classifier';
import { hybridClassifier } from '../src/vision/hybrid';
import { identify } from '../src/vision/identify';
import { openTestDb } from './node-db';

const fixed = (matches: Classification[]): VisionClassifier & { calls: number } => {
  const c = {
    calls: 0,
    async classify() {
      c.calls++;
      return matches;
    },
  };
  return c;
};
const failing = (): VisionClassifier & { calls: number } => {
  const c = {
    calls: 0,
    async classify(): Promise<Classification[]> {
      c.calls++;
      throw new Error('offline');
    },
  };
  return c;
};
const photo = { uri: 'file:///p.jpg' };

describe('hybridClassifier', () => {
  test('uses the free on-device result when it is confident, without calling the cloud', async () => {
    const local = fixed([{ itemId: 'berberine', confidence: 0.95 }]);
    const cloud = fixed([{ itemId: 'turmeric', confidence: 0.92 }]);
    const result = await hybridClassifier(local, cloud)!.classify(photo);
    assert.equal(result[0].itemId, 'berberine');
    assert.equal(cloud.calls, 0);
  });

  test('asks the cloud when on-device reading finds nothing confident', async () => {
    const local = fixed([{ itemId: 'cinnamon', confidence: 0.5 }]);
    const cloud = fixed([{ itemId: 'ginger', confidence: 0.92, label: 'fresh ginger root' }]);
    const result = await hybridClassifier(local, cloud)!.classify(photo);
    assert.equal(result[0].itemId, 'ginger');
  });

  test('keeps the on-device result when the cloud is unreachable', async () => {
    const local = fixed([{ itemId: 'cinnamon', confidence: 0.5 }]);
    const result = await hybridClassifier(local, failing())!.classify(photo);
    assert.deepEqual(result, [{ itemId: 'cinnamon', confidence: 0.5 }]);
  });

  test('survives an on-device failure by using the cloud', async () => {
    const cloud = fixed([{ itemId: 'garlic', confidence: 0.92 }]);
    const result = await hybridClassifier(failing(), cloud)!.classify(photo);
    assert.equal(result[0].itemId, 'garlic');
  });

  test('works with only one side available, and is null with neither', async () => {
    assert.equal((await hybridClassifier(null, fixed([{ itemId: 'nmn', confidence: 0.9 }]))!.classify(photo))[0].itemId, 'nmn');
    assert.equal((await hybridClassifier(fixed([{ itemId: 'nac', confidence: 0.9 }]), null)!.classify(photo))[0].itemId, 'nac');
    assert.equal(hybridClassifier(null, null), null);
  });
});

describe('identify with cloud labels', () => {
  test('names what it saw when the item is not in the library', async () => {
    const db = openTestDb();
    await migrate(db);
    const outcome = await identify({
      capture: async () => 'file:///p.jpg',
      classifier: fixed([{ itemId: 'none', confidence: 0.92, label: 'fresh kale' }]),
      lookup: (id) => getItem(db, id),
    });
    assert.deepEqual(outcome, { kind: 'miss', reason: 'not-in-library', seen: 'fresh kale' });
  });
});

describe('identifyPhoto (server)', () => {
  type Captured = Record<string, unknown>;
  const stub = (reply: { stop_reason: string; content: unknown[] }) => {
    const captured: Captured[] = [];
    const client = {
      beta: { messages: { create: async (params: Captured) => (captured.push(params), reply) } },
    } as unknown as MessagesClient;
    return { client, captured };
  };
  const jpeg = { base64: 'AAAA', mediaType: 'image/jpeg' as const };

  test('sends the photo with a schema restricted to library ids', async () => {
    const { client, captured } = stub({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"item_id":"ginger","confidence":"high","seen":"fresh ginger root"}' }],
    });
    const match = await identifyPhoto(client, jpeg);
    assert.deepEqual(match, { itemId: 'ginger', confidence: 0.92, seen: 'fresh ginger root' });

    const params = captured[0] as {
      model: string;
      fallbacks?: string;
      output_config: { format: { schema: { properties: { item_id: { enum: string[] } } } } };
      messages: { content: { type: string; source?: { data: string } }[] }[];
    };
    assert.equal(params.model, DEFAULT_MODEL);
    assert.equal(params.fallbacks, 'default');
    const ids = params.output_config.format.schema.properties.item_id.enum;
    assert.ok(ids.includes('turmeric') && ids.includes('none'));
    assert.equal(params.messages[0].content[0].source?.data, 'AAAA');
  });

  test('omits server fallbacks on models without them', async () => {
    const { client, captured } = stub({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"item_id":"none","confidence":"medium","seen":"a coffee mug"}' }],
    });
    await identifyPhoto(client, jpeg, 'claude-haiku-5-5');
    assert.equal((captured[0] as { fallbacks?: string }).fallbacks, undefined);
  });

  test('treats a refusal as no match', async () => {
    const { client } = stub({ stop_reason: 'refusal', content: [] });
    assert.deepEqual(await identifyPhoto(client, jpeg), { itemId: 'none', confidence: 0, seen: '' });
  });
});

describe('handleIdentify (HTTP)', () => {
  const post = (body: unknown) =>
    new Request('https://torapic.test/api/identify', { method: 'POST', body: JSON.stringify(body) });
  const client = {
    beta: {
      messages: {
        create: async () => ({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: '{"item_id":"garlic","confidence":"high","seen":"garlic bulb"}' }],
        }),
      },
    },
  } as unknown as MessagesClient;

  test('returns the match as JSON', async () => {
    const res = await handleIdentify(post({ image: 'AAAA', mediaType: 'image/jpeg' }), { apiKey: undefined, client });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { itemId: 'garlic', confidence: 0.92, seen: 'garlic bulb' });
  });

  test('reports a missing API key as not configured', async () => {
    const res = await handleIdentify(post({ image: 'AAAA', mediaType: 'image/jpeg' }), { apiKey: undefined });
    assert.equal(res.status, 503);
  });

  test('rejects bad requests before calling the model', async () => {
    const cfg = { apiKey: undefined, client };
    assert.equal((await handleIdentify(new Request('https://t/api/identify'), cfg)).status, 405);
    assert.equal((await handleIdentify(post({ mediaType: 'image/jpeg' }), cfg)).status, 400);
    assert.equal((await handleIdentify(post({ image: 'AAAA', mediaType: 'image/gif' }), cfg)).status, 400);
    assert.equal((await handleIdentify(post({ image: 'A'.repeat(4_000_001), mediaType: 'image/jpeg' }), cfg)).status, 400);
  });
});
