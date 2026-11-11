import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatRelative, UPLOAD_HINT, type DocSummary } from '../api';
import { Header } from '../components/Header';
import { UploadButton } from '../components/UploadButton';

export default function Dashboard() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<{ owned: DocSummary[]; shared: DocSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .listDocs()
      .then(setDocs)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

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

  const deleteDoc = (doc: DocSummary) => {
    if (!window.confirm(`Delete “${doc.title}”? People it's shared with will lose access too.`)) return;
    run('Deleting…', async () => {
      await api.deleteDoc(doc.id);
      load();
    });
  };

  return (
    <div className="page">
      <Header>
        <span className="app-title">Ajaia Docs</span>
      </Header>

      <main className="dashboard">
        <section className="start-row">
          <button className="new-doc-card" onClick={createDoc} disabled={!!busy}>
            <span className="plus" aria-hidden="true">+</span>
            <span>Blank document</span>
          </button>
          <div className="import-card">
            <UploadButton className="btn" onFile={importDoc} onInvalid={setError} disabled={!!busy}>
              ⬆ Upload a file
            </UploadButton>
            <p className="muted small">{UPLOAD_HINT}. The file becomes a new editable document.</p>
          </div>
        </section>

        {busy && <div className="alert alert-info">{busy}</div>}
        {error && (
          <div className="alert alert-error" role="alert">
            {error} <button className="link-btn" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {!docs && !error && <p className="muted">Loading documents…</p>}
        {docs && (
          <>
            <DocList
              title="My documents"
              docs={docs.owned}
              empty="You haven't created any documents yet. Start a blank one or upload a file."
              onDelete={deleteDoc}
            />
            <DocList title="Shared with me" docs={docs.shared} empty="Nothing has been shared with you yet." />
          </>
        )}
      </main>
    </div>
  );
}

function DocList({
  title,
  docs,
  empty,
  onDelete,
}: {
  title: string;
  docs: DocSummary[];
  empty: string;
  onDelete?: (d: DocSummary) => void;
}) {
  return (
    <section className="doc-section">
      <h2>
        {title} <span className="count">{docs.length}</span>
      </h2>
      {docs.length === 0 ? (
        <p className="muted empty">{empty}</p>
      ) : (
        <ul className="doc-list">
          {docs.map((d) => (
            <li key={d.id} className="doc-row">
              <Link to={`/d/${d.id}`} className="doc-link">
                <span className="doc-icon" aria-hidden="true">▤</span>
                <span className="doc-title">{d.title}</span>
              </Link>
              <span className="doc-meta">
                {d.role === 'owner' ? (
                  <span className="badge badge-owner">Owner</span>
                ) : (
                  <>
                    <span className="muted small">from {d.owner_name}</span>
                    <span className={`badge badge-${d.role}`}>{d.role === 'editor' ? 'Can edit' : 'View only'}</span>
                  </>
                )}
              </span>
              <span className="muted small doc-time">Edited {formatRelative(d.updated_at)}</span>
              <span className="doc-actions">
                {onDelete && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onDelete(d)} aria-label={`Delete ${d.title}`}>
                    Delete
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
