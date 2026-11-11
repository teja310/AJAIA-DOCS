import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Ajaia Docs home">
      <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true">
        <rect width="22" height="28" rx="3" fill="var(--accent)" />
        <rect x="5" y="8" width="12" height="2" fill="white" />
        <rect x="5" y="13" width="12" height="2" fill="white" />
        <rect x="5" y="18" width="8" height="2" fill="white" />
      </svg>
    </Link>
  );
}

/** App header: logo, page-specific middle content, and the signed-in user menu. */
export function Header({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="app-header">
      <Logo />
      <div className="header-main">{children}</div>
      <div className="header-actions">
        {actions}
        {user && (
          <div className="user-chip" title={user.email}>
            <span className="avatar" aria-hidden="true">{user.name[0]}</span>
            <span className="user-name">{user.name}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
