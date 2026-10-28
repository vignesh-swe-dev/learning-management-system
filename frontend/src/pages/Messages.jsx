import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useLiveRefresh } from '../hooks/useSocketEvent.js';

const time = (d) => new Date(d).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

function Thread({ userId, onSent }) {
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  const load = useCallback(() => {
    api.get(`/messages/with/${userId}`, { params: { limit: 100 } }).then((r) => { setData(r.data); setError(''); onSent(); }).catch((e) => setError(errorMessage(e)));
  }, [userId, onSent]);
  useEffect(() => { setData(null); load(); }, [load]);
  useLiveRefresh(['message:new'], load, 300);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [data]);

  const send = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.post('/messages', { to: userId, body: text }); setText(''); load(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="card h-100 d-flex flex-column" style={{ minHeight: 420 }}>
      <div className="card-header fw-semibold">{data ? <>{data.with.name} <span className="badge text-bg-light text-capitalize ms-1">{data.with.role}</span></> : 'Loading…'}</div>
      <div className="card-body flex-grow-1 overflow-auto" style={{ maxHeight: 460 }} role="log" aria-live="polite">
        {data?.data.length === 0 && <p className="text-muted text-center my-4">No messages yet. Say hello.</p>}
        {data?.data.map((m) => (
          <div key={m._id} className={`d-flex mb-2 ${m.mine ? 'justify-content-end' : ''}`}>
            <div className={`rounded px-3 py-2 ${m.mine ? 'bg-primary text-white' : 'bg-body-tertiary'}`} style={{ maxWidth: '80%', whiteSpace: 'pre-wrap' }}>
              {m.body}<div className="small" style={{ opacity: 0.75 }}>{time(m.createdAt)}</div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && <div className="alert alert-danger m-2 py-2" role="alert">{error}</div>}
      <form className="card-footer d-flex gap-2" onSubmit={send}>
        <label className="visually-hidden" htmlFor="msg-text">Message</label>
        <input id="msg-text" className="form-control" placeholder="Write a message" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary" disabled={busy || !text.trim()}>Send</button>
      </form>
    </div>
  );
}

export default function Messages() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [convos, setConvos] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const loadConvos = useCallback(() => { api.get('/messages/conversations').then((r) => setConvos(r.data.data)).catch((e) => setError(errorMessage(e))); }, []);
  useEffect(loadConvos, [loadConvos]);
  useLiveRefresh(['message:new'], loadConvos, 300);

  useEffect(() => {
    const t = setTimeout(() => api.get('/messages/contacts', { params: { q } }).then((r) => setContacts(r.data.data)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <h1 className="h4 mb-3">Messages</h1>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row g-3">
        <div className="col-md-4">
          <div className="card mb-3">
            <div className="card-header fw-semibold">Conversations</div>
            <div className="list-group list-group-flush">
              {convos.length === 0 && <div className="list-group-item text-muted small">No conversations yet.</div>}
              {convos.map((c) => (
                <button key={c.with._id} className={`list-group-item list-group-item-action ${userId === String(c.with._id) ? 'active' : ''}`} onClick={() => navigate(`/messages/${c.with._id}`)}>
                  <div className="d-flex"><strong className="me-auto">{c.with.name}</strong>{c.unread > 0 && <span className="badge text-bg-danger" aria-label={`${c.unread} unread`}>{c.unread}</span>}</div>
                  <div className="small text-truncate">{c.lastMessage.mine && 'You: '}{c.lastMessage.body}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header fw-semibold">Start a conversation</div>
            <div className="card-body">
              <label className="visually-hidden" htmlFor="contact-q">Search people</label>
              <input id="contact-q" className="form-control mb-2" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {contacts.length === 0 && <span className="small text-muted">No one available to message.</span>}
                {contacts.map((p) => <button key={p._id} className="btn btn-link d-block text-start p-1" onClick={() => navigate(`/messages/${p._id}`)}>{p.name} <span className="text-muted small text-capitalize">{p.role}</span></button>)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-8">
          {userId ? <Thread userId={userId} onSent={loadConvos} /> : <div className="card card-body text-center text-muted py-5">Select a conversation or start a new one.</div>}
        </div>
      </div>
    </>
  );
}
