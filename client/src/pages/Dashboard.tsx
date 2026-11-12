import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, LayoutGrid, List, Plus, Search, Trash, Upload, X } from 'lucide-react';
import { api, formatRelative, UPLOAD_HINT, type DocListItem } from '../api';
import { Header } from '../components/Header';
import { UploadButton } from '../components/UploadButton';

type View = 'grid' | 'list';
const VIEW_KEY = 'ajaia.dashboardView';

// localStorage can be unavailable (private mode, blocked storage); the view toggle is a convenience only.
function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}
function saveView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* ignore */
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<{ owned: DocListItem[]; shared: DocListItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>(loadView);

  const load = useCallback(() => {
    api
      .listDocs()
      .then(setDocs)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!docs) return null;
    const q = query.trim().toLowerCase();
    const match = (d: DocListItem) => !q || d.title.toLowerCase().includes(q);
    return { owned: docs.owned.filter(match), shared: docs.shared.filter(match) };
  }, [docs, query]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const createDoc = () =>
    run('Creating…', async () => {
      const { document } = await api.createDoc();
      navigate(`/d/${document.id}`, { state: { focusTitle: true } });
    });

  const importDoc = (file: File) =>
    run(`Importing ${file.name}…`, async () => {
      const { document } = await api.importAsNewDoc(file);
      navigate(`/d/${document.id}`);
    });

  const deleteDoc = (doc: DocListItem) => {
    if (!window.confirm(`Delete “${doc.title}”? People it's shared with will lose access too.`)) return;
    run('Deleting…', async () => {
      await api.deleteDoc(doc.id);
      load();
    });
  };

  const changeView = (v: View) => {
    setView(v);
    saveView(v);
  };

  const noMatches = !!query.trim() && filtered && filtered.owned.length + filtered.shared.length === 0;

  return (
    <div className="page">
      <Header>
        <div className="header-search-row">
          <span className="app-title">Ajaia Docs</span>
          <label className="search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search documents"
              aria-label="Search documents by title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            />
            {query && (
              <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
                <X size={16} />
              </button>
            )}
          </label>
        </div>
      </Header>

      <section className="start-strip">
        <div className="start-inner">
          <h2 className="strip-title">Start a new document</h2>
          <div className="start-row">
            <button className="start-tile" onClick={createDoc} disabled={!!busy}>
              <span className="start-thumb">
                <Plus size={44} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="start-label">Blank document</span>
            </button>
            <UploadButton className="start-tile" onFile={importDoc} onInvalid={setError} disabled={!!busy}>
              <span className="start-thumb start-thumb-upload">
                <Upload size={36} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="start-label">Upload a file</span>
            </UploadButton>
            <p className="muted small start-hint">
              {UPLOAD_HINT}.<br />
              Uploaded files become new, editable documents.
            </p>
          </div>
        </div>
      </section>

      <main className="dashboard">
        {busy && <div className="alert alert-info">{busy}</div>}
        {error && (
          <div className="alert alert-error" role="alert">
            {error} <button className="link-btn" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {!filtered && !error && <p className="muted">Loading documents…</p>}
        {noMatches && <p className="muted empty">No documents match “{query.trim()}”.</p>}
        {filtered && !noMatches && (
          <>
            <DocSection
              title="My documents"
              docs={filtered.owned}
              view={view}
              empty={query ? 'No matches in your documents.' : "You haven't created any documents yet. Start a blank one or upload a file."}
              onDelete={deleteDoc}
              toolbar={<ViewToggle view={view} onChange={changeView} />}
            />
            <DocSection
              title="Shared with me"
              docs={filtered.shared}
              view={view}
              empty={query ? 'No matches in shared documents.' : 'Nothing has been shared with you yet.'}
            />
          </>
        )}
      </main>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="view-toggle" role="group" aria-label="Layout">
      <button type="button" className={view === 'grid' ? 'is-active' : ''} aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => onChange('grid')}>
        <LayoutGrid size={18} />
      </button>
      <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} aria-label="List view" onClick={() => onChange('list')}>
        <List size={18} />
      </button>
    </div>
  );
}

function RoleMeta({ d }: { d: DocListItem }) {
  if (d.role === 'owner') return <span className="badge badge-owner">Owner</span>;
  return (
    <>
      <span className="owner-chip" title={`Owned by ${d.owner_name}`}>
        <span className="avatar avatar-xs" aria-hidden="true">{d.owner_name[0]}</span>
        <span className="owner-name">{d.owner_name}</span>
      </span>
      <span className={`badge badge-${d.role}`}>{d.role === 'editor' ? 'Can edit' : 'View only'}</span>
    </>
  );
}

function DeleteButton({ d, onDelete, className }: { d: DocListItem; onDelete: (d: DocListItem) => void; className: string }) {
  return (
    <button
      type="button"
      className={className}
      aria-label={`Delete ${d.title}`}
      title="Delete"
      onClick={(e) => {
        // The button sits inside the card's link; don't navigate.
        e.preventDefault();
        e.stopPropagation();
        onDelete(d);
      }}
    >
      <Trash size={16} />
    </button>
  );
}

function DocSection({
  title,
  docs,
  view,
  empty,
  onDelete,
  toolbar,
}: {
  title: string;
  docs: DocListItem[];
  view: View;
  empty: string;
  onDelete?: (d: DocListItem) => void;
  toolbar?: ReactNode;
}) {
  return (
    <section className="doc-section" aria-label={title}>
      <div className="section-head">
        <h2>
          {title} <span className="count">{docs.length}</span>
        </h2>
        {toolbar}
      </div>

      {docs.length === 0 ? (
        <p className="muted empty">{empty}</p>
      ) : view === 'grid' ? (
        <ul className="doc-grid">
          {docs.map((d) => (
            <li key={d.id} className="doc-item doc-card">
              <Link to={`/d/${d.id}`} className="card-link" aria-label={`Open ${d.title}`}>
                <div className="card-thumb" aria-hidden="true">
                  {d.preview ? (
                    // Preview HTML is sanitized on the server with the same whitelist as saved content.
                    <div className="card-page" dangerouslySetInnerHTML={{ __html: d.preview }} />
                  ) : (
                    <div className="card-page card-page-empty">Empty document</div>
                  )}
                </div>
                <div className="card-body">
                  <div className="card-title-row">
                    <FileText size={16} className="doc-icon" aria-hidden="true" />
                    <span className="doc-title">{d.title}</span>
                  </div>
                  <div className="card-meta">
                    <RoleMeta d={d} />
                  </div>
                  <div className="muted small">Edited {formatRelative(d.updated_at)}</div>
                </div>
                {onDelete && <DeleteButton d={d} onDelete={onDelete} className="card-delete" />}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="doc-list">
          {docs.map((d) => (
            <li key={d.id} className="doc-item doc-row">
              <Link to={`/d/${d.id}`} className="doc-link">
                <FileText size={18} className="doc-icon" aria-hidden="true" />
                <span className="doc-title">{d.title}</span>
              </Link>
              <span className="doc-meta">
                <RoleMeta d={d} />
              </span>
              <span className="muted small doc-time">Edited {formatRelative(d.updated_at)}</span>
              <span className="doc-actions">
                {onDelete && <DeleteButton d={d} onDelete={onDelete} className="icon-btn" />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
