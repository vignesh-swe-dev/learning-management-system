import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../services/api.js';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(form.email, form.password);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="text-center mb-4">
          <span
            className="brand-mark mx-auto mb-3 auth-logo d-grid"
            style={{ width: 56, height: 56, fontSize: 26, placeItems: 'center' }}
          >
            <i className="bi bi-mortarboard-fill" aria-hidden="true" />
          </span>
          <h1 className="h4 mb-1 fw-bold">Sign in to your account</h1>
          <p className="small mb-0" style={{ color: 'var(--lms-text-muted)' }}>
            Welcome back — continue your learning journey.
          </p>
        </div>

        <form className="card card-body p-4" onSubmit={submit} noValidate>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <label className="form-label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            className="form-control mb-3"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="form-control mb-4"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button className="btn btn-primary w-100" disabled={busy}>
            {busy && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center mt-3 mb-0 small" style={{ color: 'var(--lms-text-muted)' }}>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
