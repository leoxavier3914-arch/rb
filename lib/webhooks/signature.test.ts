import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';

import { inferWebhookTokenFromSignature } from '@/lib/webhooks/signature';

test('inferWebhookTokenFromSignature matches token using HMAC SHA-256 header values', () => {
  const rawBody = JSON.stringify({ id: 'evt-1', status: 'paid' });
  const tokens = ['primary-secret', 'secondary-secret'];
  const expectedToken = tokens[1]!;

  const signature = `sha256=${createHmac('sha256', expectedToken).update(rawBody).digest('hex')}`;

  const result = inferWebhookTokenFromSignature({
    headers: {
      'x-kiwify-signature': signature
    },
    rawBody,
    knownTokens: tokens
  });

  assert.equal(result, expectedToken);
});

test('inferWebhookTokenFromSignature falls back to plain hash comparison when algorithm is omitted', () => {
  const rawBody = JSON.stringify({ event: 'ping' });
  const expectedToken = 'hash-only-token';
  const hash = createHash('sha256').update(expectedToken).digest('hex');

  const result = inferWebhookTokenFromSignature({
    headers: {
      'x-webhook-signature': hash
    },
    rawBody,
    knownTokens: ['other-token', expectedToken]
  });

  assert.equal(result, expectedToken);
});

test('inferWebhookTokenFromSignature returns null when no token matches the provided signature', () => {
  const rawBody = JSON.stringify({ action: 'update' });

  const signature = createHmac('sha256', 'unknown-secret').update(rawBody).digest('hex');

  const result = inferWebhookTokenFromSignature({
    headers: {
      'x-kiwify-signature': signature
    },
    rawBody,
    knownTokens: ['known-token-1', 'known-token-2']
  });

  assert.equal(result, null);
});
