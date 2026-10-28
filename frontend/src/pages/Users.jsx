import { Fragment, useCallback, useEffect, useState } from "react";
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const LIMIT = 10;
const ROLES = ['student', 'instructor', 'parent', 'admin'];
const BLANK = { name: '', email: '', password: '', role: 'student' };
const uid = (u) => u._id || u.id;

function CreateForm({ onDone, onCancel }) {
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.post('/users', f); onDone(); } catch (x) { setErr(errorMessage(x)); setBusy(false); }
  };
  return (
    <form className="card card-body mb-3" onSubmit={submit}>
      <h2 className="h6">New user</h2>
      {err && <div className="alert alert-danger py-2" role="alert">{err}</div>}
      <div className="row g-2">
        <div className="col-md-3"><label className="form-label small" htmlFor="nu-name">Name</label><input id="nu-name" className="form-control" required minLength={2} value={f.name} onChange={set('name')} /></div>
        <div className="col-md-3"><label className="form-label small" htmlFor="nu-email">Email</label><input id="nu-email" type="email" className="form-control" required value={f.email} onChange={set('email')} /></div>
        <div className="col-md-3"><label className="form-label small" htmlFor="nu-pw">Temporary password</label><input id="nu-pw" type="password" className="form-control" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} /></div>
        <div className="col-md-3"><label className="form-label small" htmlFor="nu-role">Role</label>
          <select id="nu-role" className="form-select text-capitalize" value={f.role} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
      </div>
      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function EditPanel({ user, isSelf, onSaved, onClose }) {
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [password, setPassword] = useState('');
  const [linked, setLinked] = useState((user.linkedStudents || []).map(String));
  const [students, setStudents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (role !== 'parent') return;
    api.get('/users', { params: { role: 'student', limit: 100 } }).then((r) => setStudents(r.data.data)).catch((x) => setErr(errorMessage(x)));
  }, [role]);

  const toggle = (id) => setLinked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const save = async () => {
    setBusy(true); setErr('');
    const body = {};
    if (!isSelf && role !== user.role) body.role = role;
    if (!isSelf && status !== user.status) body.status = status;
    if (password) body.password = password;
    const before = (user.linkedStudents || []).map(String).sort().join();
    if (role === 'parent' && linked.slice().sort().join() !== before) body.linkedStudents = linked;
    if (!Object.keys(body).length) { onClose(); return; }
    try { await api.patch(`/users/${uid(user)}`, body); onSaved(); } catch (x) { setErr(errorMessage(x)); setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Permanently delete ${user.name} and all their enrollments, submissions and progress?`)) return;
    setBusy(true);
    try { await api.delete(`/users/${uid(user)}`); onSaved(); } catch (x) { setErr(errorMessage(x)); setBusy(false); }
  };

  return (
    <div className="p-3 bg-body-tertiary border-top">
      {err && <div className="alert alert-danger py-2" role="alert">{err}</div>}
      {isSelf && <p className="small text-muted mb-2">You can’t change your own role or status, or delete your own account.</p>}
      <div className="row g-2">
        <div className="col-md-3"><label className="form-label small" htmlFor={`r-${uid(user)}`}>Role</label>
          <select id={`r-${uid(user)}`} className="form-select text-capitalize" disabled={isSelf} value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div className="col-md-3"><label className="form-label small" htmlFor={`s-${uid(user)}`}>Status</label>
          <select id={`s-${uid(user)}`} className="form-select" disabled={isSelf} value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">active</option><option value="suspended">suspended</option></select></div>
        <div className="col-md-6"><label className="form-label small" htmlFor={`p-${uid(user)}`}>Reset password (optional)</label>
          <input id={`p-${uid(user)}`} type="password" className="form-control" minLength={8} autoComplete="new-password" placeholder="New password, min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      </div>
      {role === 'parent' && (
        <fieldset className="mt-3">
          <legend className="form-label small">Linked students</legend>
          <div className="border rounded p-2" style={{ maxHeight: 180, overflowY: 'auto' }}>
            {students.length === 0 && <span className="small text-muted">No student accounts found.</span>}
            {students.map((s) => (
              <div className="form-check" key={uid(s)}>
                <input className="form-check-input" type="checkbox" id={`l-${uid(user)}-${uid(s)}`} checked={linked.includes(String(uid(s)))} onChange={() => toggle(String(uid(s)))} />
                <label className="form-check-label" htmlFor={`l-${uid(user)}-${uid(s)}`}>{s.name} <span className="text-muted small">{s.email}</span></label>
              </div>
            ))}
          </div>
        </fieldset>
      )}
      <div className="d-flex flex-wrap gap-2 mt-3">
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>Save changes</button>
        <button className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={busy}>Close</button>
        {!isSelf && <button className="btn btn-outline-danger btn-sm ms-auto" onClick={remove} disabled={busy}>Delete user</button>}
      </div>
      <p className="small text-muted mt-2 mb-0">Changing role, status or password signs the user out of every device.</p>
    </div>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => { setTick((t) => t + 1); setOpenId(null); setCreating(false); }, []);

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    api.get('/users', { params: { page, limit: LIMIT, q: query || undefined, role: role || undefined } })
      .then((res) => { if (live) { setRows(res.data.data); setMeta(res.data); } })
      .catch((err) => live && setError(errorMessage(err)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [page, query, role, tick]);

  const search = (e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); };

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h4 mb-0 me-auto">Users</h1>
        <select className="form-select w-auto text-capitalize" aria-label="Filter by role" value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }}>
          <option value="">All roles</option>{ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <form className="d-flex gap-2" onSubmit={search} role="search">
          <input className="form-control" placeholder="Search name or email" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-outline-primary">Search</button>
        </form>
        <button className="btn btn-primary" onClick={() => setCreating((c) => !c)}>New user</button>
      </div>

      {creating && <CreateForm onDone={reload} onCancel={() => setCreating(false)} />}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {loading && [...Array(5)].map((_, i) => <tr key={i}><td colSpan="6"><div className="skeleton" style={{ height: 18 }} /></td></tr>)}
              {!loading && rows.length === 0 && <tr><td colSpan="6" className="text-center text-muted py-5">No users match your search.</td></tr>}
              {!loading && rows.map((u) => {
                const id = uid(u); const open = openId === id;
                return (
                  <Fragment key={id}>
                    <tr>
                      <td>{u.name}{id === uid(me) && <span className="badge text-bg-light ms-2">you</span>}</td>
                      <td>{u.email}</td>
                      <td className="text-capitalize">{u.role}</td>
                      <td><span className={`badge ${u.status === 'active' ? 'text-bg-success' : 'text-bg-secondary'}`}>{u.status}</span></td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="text-end"><button className="btn btn-outline-secondary btn-sm" aria-expanded={open} onClick={() => setOpenId(open ? null : id)}>{open ? 'Close' : 'Manage'}</button></td>
                    </tr>
                    {open && <tr><td colSpan="6" className="p-0"><EditPanel user={u} isSelf={id === uid(me)} onSaved={reload} onClose={() => setOpenId(null)} /></td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card-footer d-flex align-items-center justify-content-between">
          <span className="small text-muted">{meta.total} users</span>
          <div className="btn-group">
            <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-outline-secondary btn-sm" disabled={page >= meta.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>
    </>
  );
}
