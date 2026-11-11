import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const DEMO_USERS = [
  { email: 'alice@ajaia.test', name: 'Alice Chen' },
  { email: 'bob@ajaia.test', name: 'Bob Okafor' },
  { email: 'carol@ajaia.test', name: 'Carol Singh' },
];
const DEMO_PASSWORD = 'demo1234';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function submit(e: FormEvent, creds = { email, password }) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(creds.email, creds.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>Ajaia Docs</h1>
        <p className="muted">Sign in to create, edit and share documents.</p>

        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="demo-accounts">
          <p className="muted small">
            Demo accounts (password <code>{DEMO_PASSWORD}</code>). Click one to sign in:
          </p>
          {DEMO_USERS.map((u) => (
            <button
              key={u.email}
              type="button"
              className="demo-user"
              disabled={busy}
              onClick={(e) => submit(e, { email: u.email, password: DEMO_PASSWORD })}
            >
              <span className="avatar" aria-hidden="true">{u.name[0]}</span>
              <span>
                <strong>{u.name}</strong>
                <br />
                <span className="muted small">{u.email}</span>
              </span>
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
