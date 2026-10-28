import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLiveRefresh } from '../hooks/useSocketEvent.js';
import { useLinkedStudents } from '../hooks/useLinkedStudents.js';
import Pagination from '../components/Pagination.jsx';
import { fmtDateTime } from '../utils/format.js';

const STATUS = { open: ['text-bg-success', 'Open'], scheduled: ['text-bg-secondary', 'Scheduled'], closed: ['text-bg-dark', 'Closed'] };
const MY = { joined: ['text-bg-success', 'In session'], present: ['text-bg-success', 'Present'], absent: ['text-bg-danger', 'Absent'], not_joined: ['text-bg-warning', 'Not joined'], not_enrolled: ['text-bg-secondary', '–'] };
const mins = (s) => `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;

function Roster({ id }) {
  const [data, setData] = useState(null);
  const load = useCallback(() => api.get(`/attendance/sessions/${id}`).then((r) => setData(r.data)).catch(() => {}), [id]);
  useLiveRefresh(['attendance:joined', 'attendance:left', 'attendance:closed'], load, 500);
  if (!data) return <div className="skeleton" style={{ height: 60 }} />;
  return (
    <div className="p-3 border-top" style={{ background: 'var(--lms-surface-raised)' }}>
      <div className="small fw-semibold mb-1">Present ({data.roster.length})</div>
      {data.roster.length === 0 && <div className="small text-muted mb-2">No one has joined yet.</div>}
      <ul className="list-unstyled small mb-2">
        {data.roster.map((r, i) => <li key={i}><span className={`badge me-2 ${r.inSession ? 'text-bg-success' : 'text-bg-secondary'}`}>{r.inSession ? 'In session' : 'Left'}</span>{r.student?.name} · joined {fmtDateTime(r.joinedAt)} · {mins(r.durationSec)}</li>)}
      </ul>
      {data.session.status === 'closed' && (<><div className="small fw-semibold mb-1">Absent ({data.absent.length})</div><div className="small text-muted">{data.absent.length ? data.absent.map((u) => u.name).join(', ') : 'Everyone attended.'}</div></>)}
    </div>
  );
}

function StaffView() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], total: 0, pages: 1 });
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ courseId: '', title: '', open: true });
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get('/attendance/sessions', { params: { page, limit: 10 } }).then((r) => setRes(r.data)).catch((e) => setError(errorMessage(e))), [page]);
  useLiveRefresh(['attendance:joined', 'attendance:left', 'attendance:closed'], load, 800);
  useEffect(() => { api.get('/courses', { params: { limit: 100, ...(user.role === 'instructor' ? { mine: true } : {}) } }).then((r) => setCourses(r.data.data)).catch(() => {}); }, [user.role]);

  const create = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.post('/attendance/sessions', form); setForm({ courseId: form.courseId, title: '', open: true }); setShowForm(false); await load(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const act = async (s, action) => {
    if (action === 'close' && !window.confirm('End this session? Students who have not joined will be marked absent and notified.')) return;
    setError('');
    try { await api.patch(`/attendance/sessions/${s._id}`, { action }); await load(); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0 me-auto">Attendance</h1>
        <Link to="/reports" className="btn btn-outline-secondary me-2">Attendance reports</Link>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : <><i className="bi bi-plus-lg" aria-hidden="true" /> New session</>}</button>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {showForm && (
        <form className="card card-body mb-4" onSubmit={create}>
          <div className="row g-3 align-items-end">
            <div className="col-md-4"><label className="form-label" htmlFor="s-course">Course</label>
              <select id="s-course" className="form-select" required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}><option value="">Choose a course</option>{courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}</select></div>
            <div className="col-md-4"><label className="form-label" htmlFor="s-title">Session title</label><input id="s-title" className="form-control" required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="col-md-2"><div className="form-check"><input id="s-open" type="checkbox" className="form-check-input" checked={form.open} onChange={(e) => setForm({ ...form, open: e.target.checked })} /><label className="form-check-label" htmlFor="s-open">Start now</label></div></div>
            <div className="col-md-2"><button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button></div>
          </div>
          <div className="form-text">Starting a session notifies the enrolled students so they can join. You decide when it ends.</div>
        </form>
      )}
      <div className="card">
        {res.data.length === 0 && <div className="card-body text-center text-muted py-5">No sessions yet. Create one to start taking attendance.</div>}
        {res.data.map((s) => (
          <div key={s._id} className="border-bottom">
            <div className="p-3 d-flex flex-wrap gap-2 align-items-center">
              <div className="me-auto"><strong>{s.title}</strong><div className="small text-muted">{s.course?.title} · {fmtDateTime(s.openedAt || s.createdAt)}</div></div>
              <span className={`badge ${STATUS[s.status][0]}`}>{STATUS[s.status][1]}</span>
              <span className="small">{s.presentCount} of {s.enrolledCount} present{s.status === 'open' && ` · ${s.joinedNow} in now`}</span>
              {s.status === 'scheduled' && <button className="btn btn-success btn-sm" onClick={() => act(s, 'open')}>Open</button>}
              {s.status === 'open' && <button className="btn btn-outline-danger btn-sm" onClick={() => act(s, 'close')}>End session</button>}
              <button className="btn btn-outline-secondary btn-sm" aria-expanded={expanded === s._id} onClick={() => setExpanded(expanded === s._id ? null : s._id)}>{expanded === s._id ? 'Hide roster' : 'Roster'}</button>
            </div>
            {expanded === s._id && <Roster id={s._id} />}
          </div>
        ))}
      </div>
      <Pagination page={page} pages={res.pages} total={res.total} label="sessions" onChange={setPage} />
    </>
  );
}

function History({ report }) {
  if (!report) return <div className="skeleton" style={{ height: 100 }} />;
  if (report.courses.length === 0) return <div className="card card-body text-muted">No attendance records yet.</div>;
  return report.courses.map((c) => (
    <div key={c.course._id} className="card mb-3">
      <div className="card-header d-flex"><strong className="me-auto">{c.course.title}</strong>
        <span>{c.percent === null ? 'No sessions yet' : <><strong>{c.percent}%</strong> attendance ({c.attended} of {c.sessionCount})</>}</span></div>
      <ul className="list-group list-group-flush">
        {c.history.length === 0 && <li className="list-group-item text-muted small">No sessions yet.</li>}
        {c.history.map((h) => <li key={h.sessionId} className="list-group-item d-flex gap-2"><span className="me-auto">{h.title} <span className="small text-muted">{fmtDateTime(h.date)}</span></span>{h.status === 'present' && <span className="small text-muted">{h.minutes} min</span>}<span className={`badge ${h.status === 'present' ? 'text-bg-success' : h.status === 'open' ? 'text-bg-info' : 'text-bg-danger'}`}>{h.status === 'present' ? 'Present' : h.status === 'open' ? 'In progress' : 'Absent'}</span></li>)}
      </ul>
    </div>
  ));
}

function StudentView() {
  const [sessions, setSessions] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.get('/attendance/sessions', { params: { limit: 50 } }), api.get('/attendance/reports')]);
      setSessions(s.data.data); setReport(r.data);
    } catch (e) { setError(errorMessage(e)); }
  }, []);
  useLiveRefresh(['attendance:opened', 'attendance:closed'], load, 500);

  const act = async (s, what) => {
    setBusy(s._id); setError('');
    try { await api.post(`/attendance/sessions/${s._id}/${what}`); await load(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };
  const open = sessions.filter((s) => s.status === 'open');
  return (
    <>
      <h1 className="h4 mb-3">Attendance</h1>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <p className="small text-muted">Your attendance is recorded only when you press Join. Time in a session is measured by the server.</p>
      <h2 className="h6 text-uppercase text-muted">Live sessions</h2>
      {open.length === 0 && <div className="card card-body text-muted mb-4">No live sessions right now. You will be notified when one starts.</div>}
      {open.map((s) => (
        <div key={s._id} className="card card-body mb-3 d-flex flex-row flex-wrap align-items-center gap-3 border-success">
          <div className="me-auto"><strong>{s.title}</strong><div className="small text-muted">{s.course?.title}</div></div>
          {s.myStatus === 'joined' ? (<><span className="badge text-bg-success">You are in this session</span><button className="btn btn-outline-secondary" disabled={busy === s._id} onClick={() => act(s, 'leave')}>Leave</button></>)
            : <button className="btn btn-success" disabled={busy === s._id} onClick={() => act(s, 'join')}>{s.myStatus === 'present' ? 'Rejoin' : 'Join session'}</button>}
        </div>
      ))}
      <h2 className="h6 text-uppercase text-muted mt-4">My attendance</h2>
      <History report={report} />
    </>
  );
}

function ParentView() {
  const students = useLinkedStudents();
  const [id, setId] = useState('');
  const [report, setReport] = useState(null);
  const chosen = id || students?.[0]?._id;
  useEffect(() => { if (chosen) { setReport(null); api.get('/attendance/reports', { params: { studentId: chosen } }).then((r) => setReport(r.data)).catch(() => setReport({ courses: [] })); } }, [chosen]);
  if (!students) return <div className="skeleton" style={{ height: 100 }} />;
  if (!students.length) return <div className="card card-body text-muted">No students are linked to your account yet.</div>;
  return (
    <>
      <h1 className="h4 mb-3">Attendance</h1>
      <div className="mb-3" style={{ maxWidth: 320 }}><label className="form-label small" htmlFor="pa-student">Student</label>
        <select id="pa-student" className="form-select" value={chosen} onChange={(e) => setId(e.target.value)}>{students.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
      <p className="small text-muted">You also receive a notification whenever your student misses a session.</p>
      <History report={report} />
    </>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  if (user.role === 'student') return <StudentView />;
  if (user.role === 'parent') return <ParentView />;
  return <StaffView />;
}
