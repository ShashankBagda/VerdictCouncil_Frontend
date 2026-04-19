import React, { useState } from 'react';
import { Lock, Save, Trash2 } from 'lucide-react';

export default function HearingNotesForm({
  notes = [],
  locked = false,
  saving = false,
  onCreate,
  onDelete,
  onLock,
}) {
  const [content, setContent] = useState('');
  const [sectionReference, setSectionReference] = useState('');
  const [noteType, setNoteType] = useState('observation');

  const handleSave = async () => {
    if (!content.trim()) return;
    await onCreate?.({
      content: content.trim(),
      section_reference: sectionReference || null,
      note_type: noteType,
    });
    setContent('');
    setSectionReference('');
    setNoteType('observation');
  };

  return (
    <div className="space-y-4">
      <div className="card-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-navy-900">Hearing Notes</h3>
          <button
            onClick={onLock}
            disabled={locked || saving}
            className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" />
            {locked ? 'Locked' : 'Lock Notes'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <select
            value={sectionReference}
            onChange={(e) => setSectionReference(e.target.value)}
            disabled={locked || saving}
            className="input-field"
          >
            <option value="">Section (optional)</option>
            <option value="facts">Facts</option>
            <option value="evidence">Evidence</option>
            <option value="arguments">Arguments</option>
            <option value="legal">Legal Framework</option>
          </select>

          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value)}
            disabled={locked || saving}
            className="input-field"
          >
            <option value="observation">Observation</option>
            <option value="question">Question</option>
            <option value="annotation">Annotation</option>
          </select>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={locked || saving}
          placeholder="Capture hearing findings, evidentiary issues, and procedural notes..."
          className="input-field min-h-32"
        />

        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSave}
            disabled={locked || saving || !content.trim()}
            className="px-4 py-2 rounded-lg bg-navy-900 text-white text-sm font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>

      <div className="card-lg">
        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Saved Notes</h4>
        {notes.length === 0 ? (
          <p className="text-sm text-gray-600">No hearing notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex gap-2">
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                      {note.note_type || 'observation'}
                    </span>
                    {note.section_reference && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                        {note.section_reference}
                      </span>
                    )}
                    {note.is_locked && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-900 text-white">
                        locked
                      </span>
                    )}
                  </div>
                  {!note.is_locked && !locked && (
                    <button
                      onClick={() => onDelete?.(note.id)}
                      className="text-rose-600 hover:text-rose-700"
                      aria-label="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
