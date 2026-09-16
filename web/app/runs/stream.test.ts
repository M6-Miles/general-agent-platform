import {describe, expect, it} from 'vitest';

function parseSseChunk(chunk: string) {
  const event = chunk.match(/^event:\s*(.+)$/m)?.[1] ?? 'message';
  const data = chunk.match(/^data:\s*(.+)$/m)?.[1];
  return {event, data: data ? JSON.parse(data) : undefined};
}

describe('run SSE stream', () => {
  it('parses lifecycle event payloads', () => {
    const parsed = parseSseChunk('event: node_progress\ndata: {"sequence":2,"data":{"token":"hi"}}\n\n');
    expect(parsed.event).toBe('node_progress');
    expect(parsed.data.data.token).toBe('hi');
  });
});
