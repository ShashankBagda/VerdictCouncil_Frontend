import { describe, expect, it, vi } from 'vitest';
import {
  createIntakeTransport,
  intakeEventToChunks,
} from '../lib/ai/intakeTransport';

function readAll(stream) {
  const reader = stream.getReader();
  const chunks = [];

  const read = async () => {
    while (true) {
      const result = await reader.read();
      if (result.done) return chunks;
      chunks.push(result.value);
    }
  };

  return read();
}

function createEventSourceMock() {
  return {
    onmessage: null,
    onerror: null,
    close: vi.fn(),
    emit(payload) {
      this.onmessage?.({ data: JSON.stringify(payload) });
    },
    fail() {
      this.onerror?.();
    },
  };
}

describe('intake transport', () => {
  it('maps backend status and done events to AI SDK text chunks', () => {
    expect(
      intakeEventToChunks({
        type: 'status',
        phase: 'parsing_documents',
        ts: '2026-04-24T00:00:00Z',
      }),
    ).toEqual([
      { type: 'text-start', id: 'status-2026-04-24T00:00:00Z' },
      {
        type: 'text-delta',
        id: 'status-2026-04-24T00:00:00Z',
        delta: 'Reading the documents',
      },
      { type: 'text-end', id: 'status-2026-04-24T00:00:00Z' },
    ]);

    expect(
      intakeEventToChunks({
        type: 'done',
        extraction: { notes: 'Review **these** fields.' },
        ts: 'done-1',
      }),
    ).toEqual([
      { type: 'text-start', id: 'done-done-1' },
      { type: 'text-delta', id: 'done-done-1', delta: 'Review **these** fields.' },
      { type: 'text-end', id: 'done-done-1' },
    ]);
  });

  it('submits the latest user text and streams translated chunks', async () => {
    const source = createEventSourceMock();
    const client = {
      sendIntakeMessage: vi.fn().mockResolvedValue({}),
      streamIntakeEvents: vi.fn(() => source),
    };
    const onEvent = vi.fn();
    const transport = createIntakeTransport({ caseId: 'case-1', client, onEvent });

    const stream = await transport.sendMessages({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Correct the accused name' }],
        },
      ],
    });
    const result = readAll(stream);

    source.emit({
      type: 'done',
      extraction: { notes: 'Updated fields are ready.' },
      ts: 'done-2',
    });

    await expect(result).resolves.toEqual([
      { type: 'text-start', id: 'done-done-2' },
      { type: 'text-delta', id: 'done-done-2', delta: 'Updated fields are ready.' },
      { type: 'text-end', id: 'done-done-2' },
    ]);
    expect(client.sendIntakeMessage).toHaveBeenCalledWith('case-1', 'Correct the accused name');
    expect(client.streamIntakeEvents).toHaveBeenCalledWith('case-1');
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'done' }));
    expect(source.close).toHaveBeenCalled();
  });

  it('surfaces backend stream errors', async () => {
    const source = createEventSourceMock();
    const client = {
      sendIntakeMessage: vi.fn().mockResolvedValue({}),
      streamIntakeEvents: vi.fn(() => source),
    };
    const transport = createIntakeTransport({ caseId: 'case-2', client });

    const stream = await transport.sendMessages({ messages: [] });
    const result = readAll(stream);
    source.emit({ type: 'error', message: 'extractor unavailable' });

    await expect(result).rejects.toThrow('extractor unavailable');
  });

  it('does not claim resumable streams', async () => {
    const transport = createIntakeTransport({ caseId: 'case-3' });
    await expect(transport.reconnectToStream()).resolves.toBeNull();
  });
});
