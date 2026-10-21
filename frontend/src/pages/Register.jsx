import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../services/api.js';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await register(form);
      navigate('/dashboard', { replace: true });
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
          <h1 className="h4 mb-1 fw-bold">Create your account</h1>
          <p className="small mb-0" style={{ color: 'var(--lms-text-muted)' }}>
            Join the LMS and start learning today.
          </p>
        </div>

        <form className="card card-body p-4" onSubmit={submit} noValidate>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <label className="form-label" htmlFor="name">Full name</label>
          <input id="name" className="form-control mb-3" autoComplete="name" required value={form.name} onChange={set('name')} />

          <label className="form-label" htmlFor="email">Email address</label>
          <input id="email" type="email" className="form-control mb-3" autoComplete="email" required value={form.email} onChange={set('email')} />

          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="form-control"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={set('password')}
            aria-describedby="pw-help"
          />
          <div id="pw-help" className="form-text mb-3">At least 8 characters, with a letter and a number.</div>

          <label className="form-label" htmlFor="role">I am a</label>
          <select id="role" className="form-select mb-4" value={form.role} onChange={set('role')}>
            <option value="student">Student</option>
            <option value="parent">Parent or guardian</option>
          </select>

          <button className="btn btn-primary w-100" disabled={busy}>
            {busy && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />}
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center mt-3 mb-0 small" style={{ color: 'var(--lms-text-muted)' }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
