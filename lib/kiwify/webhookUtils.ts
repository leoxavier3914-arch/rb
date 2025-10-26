import { createHash } from 'node:crypto';

export interface EventDetails {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventPayload: Record<string, unknown>;
}

export function extractEventDetails(body: unknown, rawBody: string, fallbackType?: string | null): EventDetails {
  const envelope = isRecord(body) ? body : {};
  const event = isRecord(envelope.event) ? envelope.event : envelope;
  const eventId = typeof event.id === 'string' && event.id.trim().length > 0
    ? event.id
    : createHash('sha1').update(rawBody).digest('hex');
  const eventTypeCandidate = typeof event.type === 'string' && event.type.trim().length > 0 ? event.type : null;
  const eventType = eventTypeCandidate ?? fallbackType ?? 'unknown';
  const payload = selectPayload(envelope, event);
  return { eventId, eventType, eventPayload: payload };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function selectPayload(
  envelope: Record<string, unknown>,
  event: Record<string, unknown>
): Record<string, unknown> {
  const candidates = [event.data, envelope.data, envelope.payload, event.payload];
  for (const candidate of candidates) {
    if (isRecord(candidate)) {
      return candidate;
    }
  }
  return event;
}
