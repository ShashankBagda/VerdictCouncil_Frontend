import api, { getErrorMessage } from '@/lib/api';

const PHASE_LABEL = {
  loading_documents: 'Loading your documents',
  parsing_documents: 'Reading the documents',
  extracting_fields: 'Extracting structured fields',
  reconnect_snapshot: 'Reconnected - here is what I had',
};

const DEFAULT_PROPOSAL = 'Here is what I pulled from the documents.';

function textChunks(id, text) {
  return [
    { type: 'text-start', id },
    { type: 'text-delta', id, delta: text },
    { type: 'text-end', id },
  ];
}

function newestUserText(messages) {
  const latest = [...messages].reverse().find((message) => message.role === 'user');
  const text = latest?.parts
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
  return text || '';
}

export function intakeEventToChunks(event) {
  const id = event.id || `${event.type || 'event'}-${event.ts || Date.now()}`;

  if (event.type === 'status') {
    const label = PHASE_LABEL[event.phase] || event.phase || 'Working on the intake';
    return textChunks(id, label);
  }

  if (event.type === 'done') {
    const text = event.extraction?.notes || DEFAULT_PROPOSAL;
    return textChunks(id, text);
  }

  if (event.type === 'error') {
    return [{ type: 'error', errorText: event.message || 'The extractor failed.' }];
  }

  return [];
}

export function createIntakeTransport({
  caseId,
  client = api,
  onEvent,
  onError,
} = {}) {
  return {
    async sendMessages({ messages, abortSignal }) {
      const content = newestUserText(messages);

      if (content) {
        await client.sendIntakeMessage(caseId, content);
      }

      return new ReadableStream({
        start(controller) {
          const source = client.streamIntakeEvents(caseId);
          let closed = false;

          const close = () => {
            if (closed) return;
            closed = true;
            source.close?.();
            controller.close();
          };

          const fail = (error) => {
            if (closed) return;
            closed = true;
            source.close?.();
            const normalized = error instanceof Error ? error : new Error(String(error));
            onError?.(normalized);
            controller.error(normalized);
          };

          source.onmessage = (event) => {
            let payload;
            try {
              payload = JSON.parse(event.data);
            } catch {
              return;
            }

            onEvent?.(payload);
            intakeEventToChunks(payload).forEach((chunk) => controller.enqueue(chunk));

            if (payload.type === 'done' || payload.type === 'confirmed') {
              close();
            } else if (payload.type === 'error') {
              fail(new Error(payload.message || 'The extractor failed.'));
            }
          };

          source.onerror = () => {
            fail(new Error('Lost connection to the intake stream.'));
          };

          abortSignal?.addEventListener('abort', () => close(), { once: true });
        },
      });
    },

    async reconnectToStream() {
      return null;
    },
  };
}

export function transportErrorMessage(error) {
  return getErrorMessage(error, 'Could not update the intake chat.');
}
