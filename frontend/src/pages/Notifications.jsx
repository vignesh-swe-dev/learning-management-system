import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { useLiveRefresh } from '../hooks/useSocketEvent.js';
import Pagination from '../components/Pagination.jsx';
import { fmtDateTime } from '../utils/format.js';

const ICON = { announcement: 'bi-megaphone', attendance: 'bi-person-check', assignment: 'bi-pencil-square', grade: 'bi-award', discussion: 'bi-chat-square-text', message: 'bi-chat-dots', system: 'bi-info-circle' };

export default function Notifications() {
  const { user } = useAuth();
  const { setUnread } = useRealtime();
  const navigate = useNavigate();
  const staff = user.role === 'admin' || user.role === 'instructor';
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], total: 0, pages: 1 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ courseId: '', title: '', body: '' });
  const [sending, setSending] = useState(false);

  const load = useCallback(() => api.get('/notifications', { params: { page, limit: 15 } }).then((r) => { setRes(r.data); setUnread(r.data.unreadCount); }).catch((e) => setError(errorMessage(e))), [page, setUnread]);
  useLiveRefresh(['notification:new'], load, 300);
  useEffect(() => { if (staff) api.get('/courses', { params: { limit: 100, ...(user.role === 'instructor' ? { mine: true } : {}) } }).then((r) => setCourses(r.data.data)).catch(() => {}); }, [staff, user.role]);

  const open = async (n) => {
    if (!n.readAt) { await api.patch(`/notifications/${n._id}/read`).catch(() => {}); load(); }
    if (n.link) navigate(n.link);
  };
  const readAll = async () => { await api.post('/notifications/read-all'); load(); };
  const send = async (e) => {
    e.preventDefault(); setSending(true); setError(''); setNotice('');
    try {
      const { data } = await api.post('/notifications/announcements', { ...form, courseId: form.courseId || undefined });
      setNotice(`Sent to ${data.sent} ${data.sent === 1 ? 'person' : 'people'}.`); setForm({ ...form, title: '', body: '' });
    } catch (err) { setError(errorMessage(err)); } finally { setSending(false); }
  };

  return (
    <>
      <div className="d-flex align-items-center mb-3"><h1 className="h4 mb-0 me-auto">Notifications</h1>
        <button className="btn btn-outline-secondary btn-sm" onClick={readAll} disabled={!res.unreadCount}>Mark all as read</button></div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      {staff && (
        <form className="card card-body mb-4" onSubmit={send}>
          <h2 className="h6">Send an announcement</h2>
          <div className="row g-2">
            <div className="col-md-4"><label className="form-label small" htmlFor="n-course">To</label>
              <select id="n-course" className="form-select" required={user.role !== 'admin'} value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                {user.role === 'admin' ? <option value="">Everyone</option> : <option value="">Choose a course</option>}
                {courses.map((c) => <option key={c._id} value={c._id}>Students of {c.title}</option>)}</select></div>
            <div className="col-md-8"><label className="form-label small" htmlFor="n-title">Title</label><input id="n-title" className="form-control" required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="col-12"><label className="form-label small" htmlFor="n-body">Message</label><textarea id="n-body" rows="3" className="form-control" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          </div>
          <div className="mt-2"><button className="btn btn-primary btn-sm" disabled={sending}>{sending ? 'Sending…' : 'Send'}</button></div>
        </form>
      )}

      <div className="card">
        <div className="list-group list-group-flush" aria-live="polite">
          {res.data.length === 0 && <div className="list-group-item text-center text-muted py-5">You have no notifications yet.</div>}
          {res.data.map((n) => (
            <button key={n._id} className={`list-group-item list-group-item-action d-flex gap-3 text-start ${n.readAt ? '' : 'bg-primary-subtle'}`} onClick={() => open(n)}>
              <i className={`bi ${ICON[n.type] || ICON.system} fs-5 text-accent`} aria-hidden="true" />
              <div className="flex-grow-1"><div className={n.readAt ? '' : 'fw-semibold'}>{n.title}{!n.readAt && <span className="visually-hidden"> (unread)</span>}</div>{n.body && <div className="small text-muted">{n.body}</div>}</div>
              <span className="small text-muted text-nowrap">{fmtDateTime(n.createdAt)}</span>
            </button>
          ))}
        </div>
      </div>
      <Pagination page={page} pages={res.pages} total={res.total} label="notifications" onChange={setPage} />
    </>
  );
}
