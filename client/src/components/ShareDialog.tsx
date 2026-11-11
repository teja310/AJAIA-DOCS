import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type Share, type User } from '../api';

type ShareRole = 'viewer' | 'editor';

export function ShareDialog({ docId, title, onClose }: { docId: string; title: string; onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [shares, setShares] = useState<Share[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('editor');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    Promise.all([api.users(), api.listShares(docId)])
      .then(([u, s]) => {
        setUsers(u.users);
        setShares(s.shares);
      })
      .catch((e) => setError(e.message));
  }, [docId]);

  async function mutate(fn: () => Promise<{ shares: Share[] }>) {
    setBusy(true);
    setError(null);
    try {
      setShares((await fn()).shares);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    if (await mutate(() => api.share(docId, email, role))) setEmail('');
  }

  const sharedIds = new Set(shares?.map((s) => s.user_id));
  const candidates = users.filter((u) => !sharedIds.has(u.id));

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose} aria-labelledby="share-title">
      <div className="dialog-head">
        <h2 id="share-title">Share “{title}”</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <form className="share-form" onSubmit={add}>
        <select value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Person" disabled={busy}>
          <option value="">{candidates.length ? 'Choose a person…' : 'Everyone already has access'}</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.email}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value as ShareRole)} aria-label="Access level" disabled={busy}>
          <option value="editor">Can edit</option>
          <option value="viewer">View only</option>
        </select>
        <button className="btn btn-primary" disabled={busy || !email}>Share</button>
      </form>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <h3 className="small muted">People with access</h3>
      <ul className="share-list">
        <li>
          <span><strong>You</strong></span>
          <span className="muted small">Owner</span>
        </li>
        {shares === null && <li className="muted">Loading…</li>}
        {shares?.map((s) => (
          <li key={s.user_id}>
            <span>
              <strong>{s.name}</strong> <span className="muted small">{s.email}</span>
            </span>
            <span className="share-controls">
              <select
                value={s.role}
                disabled={busy}
                aria-label={`Access for ${s.name}`}
                onChange={(e) => mutate(() => api.share(docId, s.email, e.target.value as ShareRole))}
              >
                <option value="editor">Can edit</option>
                <option value="viewer">View only</option>
              </select>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => mutate(() => api.unshare(docId, s.user_id))}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
