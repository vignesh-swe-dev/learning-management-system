import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useLiveRefresh } from '../hooks/useSocketEvent.js';

const LIMIT = 20;
const when = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function Discussions() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', body: '' });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/discussions', { params: { courseId, page, limit: LIMIT } })
      .then((r) => { setRows(r.data.data); setMeta(r.data); setError(''); })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [courseId, page]);

  useEffect(() => { api.get(`/courses/${courseId}`).then((r) => setCourse(r.data.course)).catch(() => {}); }, [courseId]);
  useEffect(() => { load(); }, [load]); // reload when the page number changes
  useLiveRefresh(['discussion:new', 'discussion:reply'], load, 500);

  const create = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.post('/discussions', { courseId, ...form }); setForm({ title: '', body: '' }); setOpen(false); setPage(1); load(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <nav aria-label="breadcrumb"><ol className="breadcrumb small"><li className="breadcrumb-item"><Link to="/courses">Courses</Link></li><li className="breadcrumb-item"><Link to={`/courses/${courseId}`}>{course?.title || 'Course'}</Link></li><li className="breadcrumb-item active" aria-current="page">Discussions</li></ol></nav>
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0 me-auto">Discussions</h1>
        <button className="btn btn-primary" onClick={() => setOpen((o) => !o)}>{open ? 'Cancel' : 'New discussion'}</button>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {open && (
        <form className="card card-body mb-3" onSubmit={create}>
          <label className="form-label small" htmlFor="d-title">Title</label>
          <input id="d-title" className="form-control mb-2" required minLength={3} maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="form-label small" htmlFor="d-body">Your question or topic</label>
          <textarea id="d-body" className="form-control mb-2" rows={4} required maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div><button className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button></div>
        </form>
      )}
      <div className="list-group">
        {loading && <div className="list-group-item"><div className="skeleton" style={{ height: 18 }} /></div>}
        {!loading && rows.length === 0 && !error && <div className="list-group-item text-center text-muted py-5">No discussions yet. Start the first one.</div>}
        {rows.map((t) => (
          <Link key={t._id} to={`/courses/${courseId}/discussions/${t._id}`} className="list-group-item list-group-item-action">
            <div className="d-flex align-items-center gap-2">
              <strong className="me-auto">{t.pinned && <i className="bi bi-pin-angle-fill me-1" title="Pinned" aria-label="Pinned" />}{t.locked && <i className="bi bi-lock-fill me-1" title="Locked" aria-label="Locked" />}{t.title}</strong>
              <span className="badge text-bg-light">{t.replyCount} {t.replyCount === 1 ? 'reply' : 'replies'}</span>
            </div>
            <div className="small text-muted">{t.author.name}{t.author.role !== 'student' && ` (${t.author.role})`} · last activity {when(t.lastActivityAt)}</div>
            <div className="small mt-1 text-truncate">{t.preview}</div>
          </Link>
        ))}
      </div>
      {meta.pages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <span className="small text-muted">{meta.total} discussions</span>
          <div className="btn-group"><button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn btn-outline-secondary btn-sm" disabled={page >= meta.pages} onClick={() => setPage(page + 1)}>Next</button></div>
        </div>
      )}
    </>
  );
}
