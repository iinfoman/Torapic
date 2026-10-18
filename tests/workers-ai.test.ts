import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { handleIdentify } from '../server/handler';
import type { MessagesClient } from '../server/identify';
import { identifyWithWorkersAI, parseVisionReply, WORKERS_AI_MODEL, type AiRunner } from '../server/workers-ai';

const photo = { base64: 'AAAA', mediaType: 'image/jpeg' };

describe('parseVisionReply', () => {
  test('reads JSON even when the model adds chatter around it', () => {
    const reply = 'Sure! Here is the result:\n{"item_id": "ginger", "confidence": "high", "seen": "fresh ginger root"}\nHope that helps.';
    assert.deepEqual(parseVisionReply(reply), { itemId: 'ginger', confidence: 0.92, seen: 'fresh ginger root' });
  });

  test('turns invented ids into "none" but keeps what it saw', () => {
    const match = parseVisionReply('{"item_id": "kale", "confidence": "high", "seen": "kale leaves"}');
    assert.equal(match.itemId, 'none');
    assert.equal(match.seen, 'kale leaves');
  });

  test('survives garbage', () => {
    assert.deepEqual(parseVisionReply('I cannot tell.'), { itemId: 'none', confidence: 0, seen: '' });
    assert.deepEqual(parseVisionReply('{not json}'), { itemId: 'none', confidence: 0, seen: '' });
  });
});

describe('identifyWithWorkersAI', () => {
  test('sends the photo as a data URL to the vision model', async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const ai: AiRunner = {
      run: async (model, inputs) => {
        calls.push([model, inputs]);
        return { response: '{"item_id":"turmeric","confidence":"medium","seen":"turmeric root"}' };
      },
    };
    const match = await identifyWithWorkersAI(ai, photo);
    assert.deepEqual(match, { itemId: 'turmeric', confidence: 0.72, seen: 'turmeric root' });
    assert.equal(calls[0][0], WORKERS_AI_MODEL);
    assert.equal(calls[0][1].image, 'data:image/jpeg;base64,AAAA');
  });

  test('accepts the model license once, then retries', async () => {
    const prompts: unknown[] = [];
    let agreed = false;
    const ai: AiRunner = {
      run: async (_model, inputs) => {
        prompts.push(inputs.prompt ?? 'scan');
        if (inputs.prompt === 'agree') {
          agreed = true;
          return {};
        }
        if (!agreed) throw new Error('5016: Prior to using this model, you must submit the prompt "agree"');
        return { response: '{"item_id":"garlic","confidence":"high","seen":"garlic bulb"}' };
      },
    };
    assert.equal((await identifyWithWorkersAI(ai, photo)).itemId, 'garlic');
    assert.deepEqual(prompts, ['scan', 'agree', 'scan']);
  });
});

describe('handleIdentify provider choice', () => {
  const post = () => new Request('https://t/api/identify', { method: 'POST', body: JSON.stringify({ image: photo.base64, mediaType: photo.mediaType }) });
  const ai: AiRunner = { run: async () => ({ response: '{"item_id":"nmn","confidence":"high","seen":"nmn capsules"}' }) };

  test('uses free Workers AI when no Claude key is set', async () => {
    const res = await handleIdentify(post(), { apiKey: undefined, ai });
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as { itemId: string }).itemId, 'nmn');
  });

  test('prefers Claude when a key is configured', async () => {
    const client = {
      beta: {
        messages: {
          create: async () => ({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: '{"item_id":"nac","confidence":"high","seen":"nac bottle"}' }],
          }),
        },
      },
    } as unknown as MessagesClient;
    const res = await handleIdentify(post(), { apiKey: undefined, client, ai });
    assert.equal(((await res.json()) as { itemId: string }).itemId, 'nac');
  });

  test('a failing AI service returns an error the app falls back from', async () => {
    const broken: AiRunner = { run: async () => { throw new Error('daily limit reached'); } };
    const res = await handleIdentify(post(), { apiKey: undefined, ai: broken });
    assert.equal(res.status, 500);
  });
});
