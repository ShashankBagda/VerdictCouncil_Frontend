import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Streamdown } from 'streamdown';
import { useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import HearingNotesForm from '../../components/judge/HearingNotesForm';

export default function HearingPack() {
  const { caseId } = useParams();
  const { showError, showNotification } = useAPI();
  const [markdown, setMarkdown] = useState('');
  const [packStatus, setPackStatus] = useState('loading');
  const [notes, setNotes] = useState([]);
  const [savingNote, setSavingNote] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      setPackStatus('loading');
      try {
        const [md, notesPayload] = await Promise.all([
          api.getHearingPackMarkdown(caseId),
          api.listHearingNotes(caseId),
        ]);
        if (cancelled) return;
        setMarkdown(typeof md === 'string' ? md : '');
        const noteItems = notesPayload?.items || notesPayload?.data?.items || [];
        setNotes(noteItems);
        setLocked(noteItems.some((item) => item.is_locked));
        setPackStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setPackStatus('error');
        showError(getErrorMessage(error, 'Hearing pack is unavailable.'));
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
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
      await Promise.all(
        notes
          .filter((note) => !note.is_locked)
          .map((note) => api.lockHearingNote(caseId, note.id)),
      );
      setLocked(true);
      setNotes((prev) => prev.map((note) => ({ ...note, is_locked: true })));
      showNotification('Hearing notes locked.', 'success');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to lock hearing notes'));
    }
  };

  const downloadHref = api.hearingPackMarkdownUrl(caseId);

  return (
    <div className="space-y-6">
      <div className="card-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">
              Hearing Pack
            </p>
            <h1 className="text-3xl font-bold text-navy-900">Case {caseId} Hearing Pack</h1>
            <p className="text-gray-600 mt-2 max-w-3xl">
              The full case dossier as a single markdown document — preview below or
              download the .md file for offline review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                locked ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {locked ? 'Notes Locked' : 'Editable Notes'}
            </span>
            <a
              href={downloadHref}
              download={`hearing-pack-${caseId}.md`}
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Download .md
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-4">
          <div className="card-lg">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-teal-600" />
              <h2 className="text-lg font-bold text-navy-900">Pack Preview</h2>
            </div>
            {packStatus === 'loading' && (
              <p className="text-sm text-gray-600">Assembling the hearing pack…</p>
            )}
            {packStatus === 'error' && (
              <p className="text-sm text-rose-700">
                Hearing pack could not be loaded. Try again or download the .md.
              </p>
            )}
            {packStatus === 'ready' && markdown && (
              <div className="prose prose-sm max-w-none">
                <Streamdown>{markdown}</Streamdown>
              </div>
            )}
            {packStatus === 'ready' && !markdown && (
              <p className="text-sm text-gray-600">The hearing pack is empty.</p>
            )}
          </div>

          <HearingNotesForm
            notes={notes}
            locked={locked}
            saving={savingNote}
            onCreate={handleCreateNote}
            onDelete={handleDeleteNote}
            onLock={handleLock}
          />
        </div>
      </div>
    </div>
  );
}
