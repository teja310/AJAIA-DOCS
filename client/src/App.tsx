import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DocumentPage from './pages/DocumentPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-message">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/d/:id" element={<RequireAuth><DocumentPage /></RequireAuth>} />
      <Route
        path="*"
        element={
          <div className="center-message">
            <h2>Page not found</h2>
            <Link to="/">Back to documents</Link>
          </div>
        }
      />
    </Routes>
  );
}
