import { beforeEach, describe, expect, it } from 'vitest';
import {
  addHearingNote,
  getHearingSession,
  getProbativeNotes,
  lockHearingSession,
  markQueuedNotesSynced,
  startHearingSession,
} from '../lib/hearingMode';
import { storage } from '../lib/storage';

describe('hearingMode', () => {
  beforeEach(() => {
    storage.remove('hearing_sessions');
  });

  it('starts a hearing session and stores notes', () => {
    const session = startHearingSession('CASE-1');
    expect(session.active).toBe(true);

    const updated = addHearingNote('CASE-1', 'Witness contradicted prior statement.', {
      probative: true,
      status: 'saved',
      synced_at: new Date().toISOString(),
    });

    expect(updated.notes).toHaveLength(1);
    expect(getProbativeNotes('CASE-1')).toHaveLength(1);
  });

  it('queues offline notes and marks them synced', () => {
    startHearingSession('CASE-2');
    addHearingNote('CASE-2', 'Offline note', { status: 'queued' });

    expect(getHearingSession('CASE-2').queue).toHaveLength(1);

    const synced = markQueuedNotesSynced('CASE-2');
    expect(synced.queue).toHaveLength(0);
    expect(synced.notes[0].status).toBe('synced');
  });

  it('locks the session and prevents further edits', () => {
    startHearingSession('CASE-3');
    lockHearingSession('CASE-3');

    expect(getHearingSession('CASE-3').locked).toBe(true);
    expect(() => addHearingNote('CASE-3', 'Should fail')).toThrow(
      'Hearing notes are locked for this case.',
    );
  });
});
