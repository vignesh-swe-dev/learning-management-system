import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useLiveRefresh } from '../hooks/useSocketEvent.js';

const when = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const Who = ({ a }) => <strong>{a.name}{a.role && a.role !== 'student' && <span className="badge text-bg-primary ms-1 text-capitalize">{a.role}</span>}</strong>;

export default function DiscussionThread() {
  const { courseId, threadId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/discussions/${threadId}`, { params: { limit: 100 } })
      .then((r) => { setData(r.data); setError(''); })
      .catch((e) => setError(errorMessage(e)));
  }, [threadId]);
  useLiveRefresh(['discussion:reply'], load, 400);

  const act = async (fn) => { setError(''); try { await fn(); } catch (e) { setError(errorMessage(e)); } };
  const reply = (e) => { e.preventDefault(); setBusy(true); act(async () => { await api.post(`/discussions/${threadId}/replies`, { body }); setBody(''); load(); }).finally(() => setBusy(false)); };
  const moderate = (patch) => act(async () => { await api.patch(`/discussions/${threadId}`, patch); load(); });
  const delThread = () => window.confirm('Delete this discussion and all its replies?') && act(async () => { await api.delete(`/discussions/${threadId}`); navigate(`/courses/${courseId}/discussions`); });
  const delReply = (id) => window.confirm('Delete this reply?') && act(async () => { await api.delete(`/discussions/${threadId}/replies/${id}`); load(); });

  if (!data) return error ? <div className="alert alert-danger" role="alert">{error}</div> : <div className="skeleton" style={{ height: 120 }} />;
  const { discussion: t, replies, canModerate, canDelete } = data;
  const locked = t.locked && !canModerate;

  return (
    <>
      <nav aria-label="breadcrumb"><ol className="breadcrumb small"><li className="breadcrumb-item"><Link to={`/courses/${courseId}`}>Course</Link></li><li className="breadcrumb-item"><Link to={`/courses/${courseId}/discussions`}>Discussions</Link></li><li className="breadcrumb-item active" aria-current="page">Thread</li></ol></nav>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2 align-items-start">
            <h1 className="h5 mb-0 me-auto">{t.pinned && <i className="bi bi-pin-angle-fill me-1" aria-label="Pinned" />}{t.locked && <i className="bi bi-lock-fill me-1" aria-label="Locked" />}{t.title}</h1>
            {canModerate && <button className="btn btn-outline-secondary btn-sm" onClick={() => moderate({ pinned: !t.pinned })}>{t.pinned ? 'Unpin' : 'Pin'}</button>}
            {canModerate && <button className="btn btn-outline-secondary btn-sm" onClick={() => moderate({ locked: !t.locked })}>{t.locked ? 'Unlock' : 'Lock'}</button>}
            {canDelete && <button className="btn btn-outline-danger btn-sm" onClick={delThread}>Delete</button>}
          </div>
          <div className="small text-muted mb-2"><Who a={t.author} /> · {when(t.createdAt)}</div>
          <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{t.body}</p>
        </div>
      </div>

      <h2 className="h6">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</h2>
      {replies.map((r) => (
        <div className="card mb-2" key={r._id}>
          <div className="card-body py-2">
            <div className="d-flex align-items-center small text-muted"><span className="me-auto"><Who a={r.author} /> · {when(r.createdAt)}</span>{r.canDelete && <button className="btn btn-link btn-sm text-danger p-0" onClick={() => delReply(r._id)}>Delete</button>}</div>
            <p className="mb-0 mt-1" style={{ whiteSpace: 'pre-wrap' }}>{r.body}</p>
          </div>
        </div>
      ))}

      {locked ? <div className="alert alert-secondary mt-3">This discussion is locked.</div> : (
        <form className="mt-3" onSubmit={reply}>
          <label className="form-label small" htmlFor="reply-body">Your reply</label>
          <textarea id="reply-body" className="form-control mb-2" rows={3} required maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !body.trim()}>{busy ? 'Posting…' : 'Reply'}</button>
        </form>
      )}
    </>
  );
}
