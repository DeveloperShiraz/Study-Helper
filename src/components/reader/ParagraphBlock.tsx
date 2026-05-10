import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import type { Paragraph } from '../../types';
import { VersionToggle } from './VersionToggle';

interface ParagraphBlockProps {
  paragraph: Paragraph;
  onUpdated: () => void;
}

export function ParagraphBlock({ paragraph, onUpdated }: ParagraphBlockProps) {
  const { state } = useApp();
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  const displayText =
    paragraph.activeVersion === 'modified' && paragraph.modified ? paragraph.modified : paragraph.original;

  async function handleVersionChange(version: Paragraph['activeVersion']) {
    if (!state.user) return;
    const { error } = await supabase
      .from('paragraphs')
      .update({ active_version: version, updated_at: new Date().toISOString() })
      .eq('id', paragraph.id)
      .eq('user_id', state.user.id);
    if (!error) onUpdated();
  }

  async function handleDeleteNote() {
    if (!state.user) return;
    const { error } = await supabase
      .from('paragraphs')
      .update({ pinned_note: null, updated_at: new Date().toISOString() })
      .eq('id', paragraph.id)
      .eq('user_id', state.user.id);
    if (!error) {
      setIsNoteOpen(false);
      onUpdated();
    }
  }

  const blockClass = 'group relative rounded-lg border border-transparent px-2 py-3 hover:border-gray-200';

  return (
    <div className={blockClass} data-paragraph-id={paragraph.id}>
      <div className="flex gap-3">
        <p className="flex-1 whitespace-pre-wrap text-base leading-relaxed text-gray-900">{displayText}</p>
        {paragraph.pinnedNote && (
          <button
            type="button"
            className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200"
            aria-label="View pinned note"
            onClick={() => setIsNoteOpen((v) => !v)}
          >
            Pin
          </button>
        )}
      </div>

      <VersionToggle paragraph={paragraph} onSelect={handleVersionChange} />

      {isNoteOpen && paragraph.pinnedNote && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-gray-900">
          <p className="whitespace-pre-wrap">{paragraph.pinnedNote}</p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="text-xs text-red-700 hover:underline"
              onClick={handleDeleteNote}
            >
              Delete note
            </button>
            <button type="button" className="text-xs text-gray-700 hover:underline" onClick={() => setIsNoteOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
