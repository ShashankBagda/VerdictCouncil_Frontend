import React, { useEffect, useState } from 'react';
import {
  BookMarked,
  CheckCircle,
  Clock,
  Lock,
  Mic,
  Send,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAPI, useOnline } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import {
  addHearingNote,
  getHearingSession,
  getProbativeNotes,
  lockHearingSession,
  markQueuedNotesSynced,
  startHearingSession,
} from '../../lib/hearingMode';

export default function HearingPack() {
  const { caseId } = useParams();
  const isOnline = useOnline();
  const { showError, showNotification } = useAPI();
  const [packStatus, setPackStatus] = useState('idle');
  const [hearingSession, setHearingSession] = useState(() => getHearingSession(caseId));
  const [noteText, setNoteText] = useState('');
  const [probative, setProbative] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setHearingSession(getHearingSession(caseId));
  }, [caseId]);

  useEffect(() => {
    const hydratePack = async () => {
      try {
        setPackStatus('loading');
        await api.generateHearingPack(caseId);
        setPackStatus('ready');
      } catch (error) {
        setPackStatus('fallback');
        showError(getErrorMessage(error, 'Hearing pack generation is unavailable. Showing local hearing mode.'));
      }
    };

    hydratePack();
  }, [caseId, showError]);

  useEffect(() => {
    if (!isOnline || !hearingSession.queue.length || hearingSession.locked) {
      return;
    }

    const syncQueuedNotes = async () => {
      try {
        setSyncing(true);
        setHearingSession(markQueuedNotesSynced(caseId));
        showNotification('Queued hearing notes synced locally.', 'success');
      } finally {
        setSyncing(false);
      }
    };

    syncQueuedNotes();
  }, [caseId, hearingSession.locked, hearingSession.queue.length, isOnline, showNotification]);

  const probativeNotes = getProbativeNotes(caseId);

  const handleStartSession = () => {
    setHearingSession(startHearingSession(caseId));
    showNotification('Hearing mode started. Notes now persist locally for this case.', 'success');
  };

  const handleAddNote = () => {
    if (!noteText.trim()) {
      showError('Enter a note before saving.');
      return;
    }

    try {
      const status = isOnline ? 'saved' : 'queued';
      setHearingSession(
        addHearingNote(caseId, noteText.trim(), {
          probative,
          status,
          synced_at: isOnline ? new Date().toISOString() : null,
        }),
      );
      setNoteText('');
      setProbative(false);
      showNotification(
        isOnline ? 'Hearing note saved.' : 'Offline: hearing note queued for sync.',
        isOnline ? 'success' : 'info',
      );
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to save hearing note'));
    }
  };

  const handleLockSession = () => {
    setHearingSession(lockHearingSession(caseId));
    showNotification('Hearing mode ended. Notes are now locked for this case.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="card-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">
              Hearing Mode
            </p>
            <h1 className="text-3xl font-bold text-navy-900">Case {caseId} Hearing Pack</h1>
            <p className="text-gray-600 mt-2 max-w-3xl">
              Capture hearing notes with offline resilience and lock the record once the hearing is complete.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {isOnline ? (
                <span className="inline-flex items-center gap-1"><Wifi className="w-3 h-3" /> Online</span>
              ) : (
                <span className="inline-flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline</span>
              )}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${hearingSession.locked ? 'bg-gray-200 text-gray-700' : hearingSession.active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
              {hearingSession.locked ? 'Locked' : hearingSession.active ? 'Active session' : 'Not started'}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${packStatus === 'ready' ? 'bg-emerald-100 text-emerald-700' : packStatus === 'fallback' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
              {packStatus === 'ready' ? 'Pack ready' : packStatus === 'fallback' ? 'Local fallback' : 'Preparing'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-4">
          <div className="card-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-teal-600" />
                <h2 className="text-lg font-bold text-navy-900">Live Hearing Notes</h2>
              </div>
              {!hearingSession.active && !hearingSession.locked && (
                <button
                  onClick={handleStartSession}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700"
                >
                  Start Hearing Mode
                </button>
              )}
            </div>

            {hearingSession.locked ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 flex items-start gap-3">
                <Lock className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-navy-900">Hearing notes are locked</p>
                  <p className="mt-1">
                    This hearing session ended on {hearingSession.ended_at ? new Date(hearingSession.ended_at).toLocaleString() : 'an earlier time'}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  disabled={!hearingSession.active}
                  placeholder={
                    hearingSession.active
                      ? 'Record factual observations, evidentiary issues, and live hearing notes'
                      : 'Start hearing mode to begin capturing notes'
                  }
                  className="input-field min-h-40"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={probative}
                    disabled={!hearingSession.active}
                    onChange={(event) => setProbative(event.target.checked)}
                  />
                  Mark as probative for later decision review
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-gray-500">
                    {isOnline ? 'Notes save immediately to local hearing storage.' : 'Notes will queue locally and sync when you reconnect.'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddNote}
                      disabled={!hearingSession.active}
                      className="px-4 py-2 rounded-lg bg-navy-900 text-white font-semibold hover:bg-navy-800 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Save Note
                    </button>
                    <button
                      onClick={handleLockSession}
                      disabled={!hearingSession.active}
                      className="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      End Hearing
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card-lg">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-navy-900" />
              <h2 className="text-lg font-bold text-navy-900">Captured Notes</h2>
            </div>

            {hearingSession.notes.length > 0 ? (
              <div className="space-y-3">
                {hearingSession.notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${note.probative ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-700'}`}>
                          {note.probative ? 'Probative' : 'General'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${note.status === 'queued' ? 'bg-amber-100 text-amber-700' : note.status === 'synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {note.status}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.text}</p>
                    {note.synced_at && (
                      <p className="text-xs text-gray-500 mt-2">
                        Synced {new Date(note.synced_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No hearing notes have been captured for this case yet.</p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card-lg">
            <div className="flex items-center gap-2 mb-4">
              <BookMarked className="w-5 h-5 text-violet-600" />
              <h2 className="text-lg font-bold text-navy-900">Probative Note Summary</h2>
            </div>
            {probativeNotes.length > 0 ? (
              <div className="space-y-3">
                {probativeNotes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.text}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(note.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Notes marked as probative will appear here to support later decision review.
              </p>
            )}
          </div>

          <div className="card-lg">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-navy-900">Session Status</h2>
            </div>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Started:</span>{' '}
                {hearingSession.started_at ? new Date(hearingSession.started_at).toLocaleString() : 'Not started'}
              </p>
              <p>
                <span className="font-semibold">Ended:</span>{' '}
                {hearingSession.ended_at ? new Date(hearingSession.ended_at).toLocaleString() : 'Still active'}
              </p>
              <p>
                <span className="font-semibold">Queued notes:</span> {hearingSession.queue.length}
              </p>
              <p>
                <span className="font-semibold">Sync status:</span>{' '}
                {syncing ? 'Syncing queued notes...' : isOnline ? 'Ready' : 'Waiting for connection'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
