import { storage } from './storage';

const HEARING_SESSIONS_KEY = 'hearing_sessions';

const readSessions = () => storage.get(HEARING_SESSIONS_KEY) || {};

const writeSessions = (sessions) => {
  storage.set(HEARING_SESSIONS_KEY, sessions);
};

const normalizeNote = (note, index = 0) => ({
  id: note?.id || `note-${index}`,
  text: note?.text || '',
  created_at: note?.created_at || new Date().toISOString(),
  status: note?.status || 'saved',
  synced_at: note?.synced_at || null,
  probative: Boolean(note?.probative),
});

export const getHearingSession = (caseId) => {
  const sessions = readSessions();
  const session = sessions[String(caseId)];

  if (!session) {
    return {
      caseId: String(caseId),
      active: false,
      locked: false,
      started_at: null,
      ended_at: null,
      notes: [],
      queue: [],
    };
  }

  return {
    caseId: String(caseId),
    active: Boolean(session.active),
    locked: Boolean(session.locked),
    started_at: session.started_at || null,
    ended_at: session.ended_at || null,
    notes: Array.isArray(session.notes) ? session.notes.map(normalizeNote) : [],
    queue: Array.isArray(session.queue) ? session.queue.map(normalizeNote) : [],
  };
};

const persistSession = (caseId, session) => {
  const sessions = readSessions();
  sessions[String(caseId)] = session;
  writeSessions(sessions);
  return getHearingSession(caseId);
};

export const startHearingSession = (caseId) =>
  persistSession(caseId, {
    ...getHearingSession(caseId),
    active: true,
    locked: false,
    started_at: new Date().toISOString(),
    ended_at: null,
  });

export const addHearingNote = (caseId, text, options = {}) => {
  const session = getHearingSession(caseId);
  if (session.locked) {
    throw new Error('Hearing notes are locked for this case.');
  }

  const createdAt = new Date().toISOString();
  const note = normalizeNote({
    id: `note-${Date.now()}`,
    text,
    created_at: createdAt,
    status: options.status || 'saved',
    synced_at: options.synced_at || null,
    probative: Boolean(options.probative),
  });

  return persistSession(caseId, {
    ...session,
    notes: [note, ...session.notes],
    queue: note.status === 'queued' ? [note, ...session.queue] : session.queue,
  });
};

export const markQueuedNotesSynced = (caseId) => {
  const session = getHearingSession(caseId);
  const syncedAt = new Date().toISOString();

  return persistSession(caseId, {
    ...session,
    notes: session.notes.map((note) => ({
      ...note,
      status: note.status === 'queued' ? 'synced' : note.status,
      synced_at: note.status === 'queued' ? syncedAt : note.synced_at,
    })),
    queue: [],
  });
};

export const lockHearingSession = (caseId) =>
  persistSession(caseId, {
    ...getHearingSession(caseId),
    active: false,
    locked: true,
    ended_at: new Date().toISOString(),
  });

export const getProbativeNotes = (caseId) =>
  getHearingSession(caseId).notes.filter((note) => note.probative);
