import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Scale,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import HearingNotesForm from '../../components/judge/HearingNotesForm';

export default function HearingPack() {
  const { caseId } = useParams();
  const { showError, showNotification } = useAPI();
  const [packStatus, setPackStatus] = useState('loading');
  const [pack, setPack] = useState(null);
  const [notes, setNotes] = useState([]);
  const [savingNote, setSavingNote] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const hydratePack = async () => {
      try {
        setPackStatus('loading');
        const [packPayload, notesPayload] = await Promise.all([
          api.generateHearingPack(caseId),
          api.listHearingNotes(caseId),
        ]);
        const nextPack = packPayload?.data || packPayload || null;
        const noteItems = notesPayload?.items || notesPayload?.data?.items || [];
        setPack(nextPack);
        setNotes(noteItems);
        setLocked(noteItems.some((item) => item.is_locked));
        setPackStatus('ready');
      } catch (error) {
        setPackStatus('fallback');
        showError(getErrorMessage(error, 'Hearing pack generation is unavailable.'));
      }
    };

    hydratePack();
  }, [caseId, showError]);

  const handleCreateNote = async (payload) => {
    try {
      setSavingNote(true);
      const created = await api.createHearingNote(caseId, payload);
      const note = created?.data || created;
      setNotes((prev) => [note, ...prev]);
      showNotification('Hearing note saved.', 'success');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to save hearing note'));
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.deleteHearingNote(caseId, noteId);
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      showNotification('Hearing note deleted.', 'success');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to delete hearing note'));
    }
  };

  const handleLock = async () => {
    if (!notes.length) {
      showError('Create at least one hearing note before locking.');
      return;
    }

    try {
      await Promise.all(notes.filter((note) => !note.is_locked).map((note) => api.lockHearingNote(caseId, note.id)));
      setLocked(true);
      setNotes((prev) => prev.map((note) => ({ ...note, is_locked: true })));
      showNotification('Hearing notes locked.', 'success');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to lock hearing notes'));
    }
  };

  const sectionCounts = useMemo(
    () => ({
      parties: pack?.parties?.length || 0,
      facts: pack?.facts?.length || 0,
      evidence: pack?.evidence?.length || 0,
      witnesses: pack?.witnesses?.length || 0,
    }),
    [pack],
  );

  return (
    <div className="space-y-6">
      <div className="card-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">Hearing Pack</p>
            <h1 className="text-3xl font-bold text-navy-900">Case {caseId} Hearing Pack</h1>
            <p className="text-gray-600 mt-2 max-w-3xl">Generate structured pack data and maintain locked hearing notes for judicial review.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${locked ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
              {locked ? 'Notes Locked' : 'Editable Notes'}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${packStatus === 'ready' ? 'bg-emerald-100 text-emerald-700' : packStatus === 'fallback' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
              {packStatus === 'ready' ? 'Pack ready' : packStatus === 'fallback' ? 'Local fallback' : 'Preparing'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-4">
          <HearingNotesForm
            notes={notes}
            locked={locked}
            saving={savingNote}
            onCreate={handleCreateNote}
            onDelete={handleDeleteNote}
            onLock={handleLock}
          />
        </div>

        <aside className="space-y-4">
          <div className="card-lg">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-teal-600" />
              <h2 className="text-lg font-bold text-navy-900">Pack Contents</h2>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <p><span className="font-semibold">Parties:</span> {sectionCounts.parties}</p>
              <p><span className="font-semibold">Facts:</span> {sectionCounts.facts}</p>
              <p><span className="font-semibold">Evidence:</span> {sectionCounts.evidence}</p>
              <p><span className="font-semibold">Witnesses:</span> {sectionCounts.witnesses}</p>
            </div>
          </div>

          <div className="card-lg">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-5 h-5 text-violet-600" />
              <h2 className="text-lg font-bold text-navy-900">Current Verdict</h2>
            </div>
            {pack?.current_verdict ? (
              <div className="text-sm text-gray-700 space-y-2">
                <p>
                  <span className="font-semibold">Recommendation:</span>{' '}
                  {pack.current_verdict.recommendation_type || 'n/a'}
                </p>
                <p>
                  <span className="font-semibold">Outcome:</span>{' '}
                  {pack.current_verdict.recommended_outcome || 'n/a'}
                </p>
                <p>
                  <span className="font-semibold">Confidence:</span>{' '}
                  {pack.current_verdict.confidence_score ?? 'n/a'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">No verdict available for this case yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
