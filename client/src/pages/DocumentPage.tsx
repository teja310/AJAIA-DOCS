import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { api, ApiError, formatRelative, UPLOAD_HINT, type Doc } from '../api';
import { Header } from '../components/Header';
import { Toolbar } from '../components/Toolbar';
import { ShareDialog } from '../components/ShareDialog';
import { UploadButton } from '../components/UploadButton';
import { useAutosave, type SaveStatus } from '../useAutosave';

/** Loads the document, then hands off to the editor once we know its content and role. */
export default function DocumentPage() {
  const { id = '' } = useParams();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    setDoc(null);
    setError(null);
    api
      .getDoc(id)
      .then(({ document }) => setDoc(document))
      .catch(setError);
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <Header />
        <div className="center-message">
          <h2>{error.status === 404 ? 'Document not found' : 'Could not open document'}</h2>
          <p className="muted">
            {error.status === 404 ? "It may have been deleted, or it hasn't been shared with you." : error.message}
          </p>
          <Link to="/" className="btn">Back to documents</Link>
        </div>
      </div>
    );
  }
  if (!doc) return <div className="center-message">Loading document…</div>;
  return <Editor key={doc.id} initial={doc} />;
}

function Editor({ initial }: { initial: Doc }) {
  const location = useLocation();
  const canEdit = initial.role !== 'viewer';
  const isOwner = initial.role === 'owner';

  const [title, setTitle] = useState(initial.title);
  const [savedTitle, setSavedTitle] = useState(initial.title);
  const [updatedAt, setUpdatedAt] = useState(initial.updated_at);
  const [showShare, setShowShare] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false },
        code: false,
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder: canEdit ? 'Start typing…' : '' }),
    ],
    content: initial.content_html,
    editable: canEdit,
    onUpdate: () => save.markContentChanged(),
  });

  const save = useAutosave(
    initial.id,
    initial.version,
    () => editor?.getHTML() ?? '',
    (d) => {
      setUpdatedAt(d.updated_at);
      setSavedTitle(d.title);
    },
  );

  // After a conflict, freeze the editor so the user doesn't keep typing work that can't be saved.
  useEffect(() => {
    if (save.status === 'conflict') editor?.setEditable(false);
  }, [save.status, editor]);

  // Focus the title on brand-new documents so renaming is the obvious first step.
  useEffect(() => {
    if ((location.state as { focusTitle?: boolean } | null)?.focusTitle) titleInput.current?.select();
  }, [location.state]);

  // Ctrl/Cmd+S saves immediately instead of opening the browser's save dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save.flush();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save.flush]);

  useEffect(() => {
    document.title = `${savedTitle} – Ajaia Docs`;
    return () => {
      document.title = 'Ajaia Docs';
    };
  }, [savedTitle]);

  function commitTitle() {
    const next = title.trim();
    if (!next) {
      setTitle(savedTitle);
      setNotice({ kind: 'error', text: 'Title cannot be empty.' });
      return;
    }
    if (next.length > 200) {
      setNotice({ kind: 'error', text: 'Title is too long (max 200 characters).' });
      return;
    }
    setTitle(next);
    if (next !== savedTitle) save.setTitle(next);
  }

  async function importFile(file: File) {
    if (!editor) return;
    setImporting(true);
    setNotice(null);
    try {
      await save.flush(); // persist local edits first so the append lands on the latest version
      const { document } = await api.importIntoDoc(initial.id, file);
      editor.commands.setContent(document.content_html, { emitUpdate: false });
      save.adoptVersion(document.version);
      setUpdatedAt(document.updated_at);
      setNotice({ kind: 'info', text: `Imported “${file.name}” at the end of the document.` });
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page doc-page">
      <div className="doc-top">
        <Header
          actions={
            <>
              {canEdit && (
                <UploadButton
                  className="btn btn-sm"
                  disabled={importing || save.status === 'conflict'}
                  onFile={importFile}
                  onInvalid={(text) => setNotice({ kind: 'error', text })}
                >
                  {importing ? 'Importing…' : '⬆ Import file'}
                </UploadButton>
              )}
              {isOwner && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowShare(true)}>
                  Share
                </button>
              )}
            </>
          }
        >
          <div className="doc-heading">
            <input
              ref={titleInput}
              className="title-input"
              value={title}
              maxLength={200}
              readOnly={!canEdit}
              aria-label="Document title"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTitle();
                  editor?.commands.focus('start');
                }
                if (e.key === 'Escape') {
                  setTitle(savedTitle);
                  e.currentTarget.blur();
                }
              }}
            />
            <div className="doc-sub">
              {canEdit ? (
                <SaveIndicator status={save.status} updatedAt={updatedAt} onRetry={save.flush} />
              ) : (
                <span className="muted small">Last edited {formatRelative(updatedAt)}</span>
              )}
              {!isOwner && <span className="muted small">· Owned by {initial.owner_name}</span>}
            </div>
          </div>
        </Header>

        {canEdit && editor && <Toolbar editor={editor} />}
        {!canEdit && (
          <div className="banner">
            👁 You have <strong>view-only</strong> access. Ask {initial.owner_name} for edit access.
          </div>
        )}
        {save.status === 'conflict' && (
          <div className="banner banner-error" role="alert">
            {save.error}{' '}
            <button className="btn btn-sm" onClick={() => window.location.reload()}>Reload latest</button>
          </div>
        )}
        {notice && (
          <div className={`banner ${notice.kind === 'error' ? 'banner-error' : 'banner-info'}`} role="status">
            {notice.text} <button className="link-btn" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        )}
      </div>

      <main className="canvas">
        <div className="paper">
          <EditorContent editor={editor} className="editor" />
        </div>
        {canEdit && <p className="muted small canvas-hint">Import adds content to the end of this doc. {UPLOAD_HINT}.</p>}
      </main>

      {showShare && <ShareDialog docId={initial.id} title={savedTitle} onClose={() => setShowShare(false)} />}
    </div>
  );
}

function SaveIndicator({ status, updatedAt, onRetry }: { status: SaveStatus; updatedAt: string; onRetry: () => void }) {
  switch (status) {
    case 'saving':
      return <span className="save-pill">Saving…</span>;
    case 'unsaved':
      return <span className="save-pill">Unsaved changes</span>;
    case 'error':
      return (
        <span className="save-pill save-error">
          Couldn't save. <button className="link-btn" onClick={onRetry}>Retry</button>
        </span>
      );
    case 'conflict':
      return <span className="save-pill save-error">Not saved: newer version exists</span>;
    default:
      return <span className="save-pill save-ok" title={new Date(updatedAt).toLocaleString()}>✓ Saved {formatRelative(updatedAt)}</span>;
  }
}
