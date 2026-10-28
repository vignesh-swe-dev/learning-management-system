import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { useSocketEvent } from '../hooks/useSocketEvent.js';
import ActivityList from '../components/ActivityList.jsx';
import { fromEvent, LIVE_FEED_EVENTS } from '../utils/activity.js';
import { fmtDateTime } from '../utils/format.js';

const sinceText = (d) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(d)) / 1000));
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
};

export default function LiveActivity() {
  const { connected, readyCount } = useRealtime();
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [online, setOnline] = useState(new Map());
  const [hidden, setHidden] = useState(0);
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState('');
  const [, tick] = useState(0);
  const courseRef = useRef('');
  courseRef.current = courseId;

  useEffect(() => { api.get('/courses', { params: { limit: 100, mine: true } }).then((r) => setCourses(r.data.data)).catch(() => {}); }, []);
  // Re-tick every 30 s so "5 min ago" text stays honest without any server traffic.
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  // Initial state and recovery after a reconnect come from REST; live events then patch it.
  const load = useCallback(async () => {
    try {
      const params = courseId ? { courseId } : {};
      const [a, f] = await Promise.all([api.get('/tracking/active-students', { params }), api.get('/tracking/activity', { params: { ...params, limit: 20 } })]);
      setOnline(new Map(a.data.data.map((r) => [r.student.id, r])));
      setHidden(a.data.hiddenCount);
      setFeed(f.data.data);
      setError('');
    } catch (e) { setError(errorMessage(e)); }
  }, [courseId]);
  useEffect(() => { load(); }, [load, readyCount]);

  const inScope = (cid) => !courseRef.current || courseRef.current === cid;
  const patch = (id, fn) => setOnline((m) => { const n = new Map(m); const cur = n.get(id); if (cur) n.set(id, { ...cur, ...fn(cur), lastActivityAt: new Date().toISOString() }); return n; });

  useSocketEvent('user:online', (p) => { if (!inScope(p.courseId)) return; setOnline((m) => new Map(m).set(p.studentId, { student: { id: p.studentId, name: p.studentName }, courseId: p.courseId, courseTitle: null, lessonId: null, lessonTitle: null, onlineSince: p.onlineSince, lastActivityAt: new Date().toISOString() })); });
  useSocketEvent('user:offline', (p) => setOnline((m) => { const n = new Map(m); n.delete(p.studentId); return n; }));
  useSocketEvent('course:joined', (p) => patch(p.studentId, () => ({ courseId: p.courseId, courseTitle: p.courseTitle })));
  useSocketEvent('lesson:started', (p) => { patch(p.studentId, () => ({ courseId: p.courseId, courseTitle: p.courseTitle, lessonId: p.lessonId, lessonTitle: p.lessonTitle })); });
  useSocketEvent('lesson:stopped', (p) => patch(p.studentId, () => ({ lessonId: null, lessonTitle: null })));
  useSocketEvent('lesson:progress', (p) => patch(p.studentId, () => ({ lessonId: p.lessonId, lessonTitle: p.lessonTitle })));
  LIVE_FEED_EVENTS.forEach((ev) => useSocketEvent(ev, (p) => { // eslint-disable-line react-hooks/rules-of-hooks
    if (!inScope(p.courseId)) return;
    const item = fromEvent(ev, p);
    if (item) setFeed((f) => [item, ...f.filter((x) => x.id !== item.id)].slice(0, 30));
  }));

  const rows = [...online.values()].sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h4 mb-0 me-auto">Live activity</h1>
        <span className={`badge ${connected ? 'text-bg-success' : 'text-bg-secondary'}`} role="status"><i className="bi bi-circle-fill me-1" style={{ fontSize: 8 }} aria-hidden="true" />{connected ? 'Live' : 'Reconnecting…'}</span>
        <label className="visually-hidden" htmlFor="live-course">Course</label>
        <select id="live-course" className="form-select w-auto" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">All my courses</option>{courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
        </select>
      </div>
      <p className="small text-muted">This view shows what students do inside the LMS: whether they are online, which lesson they have open, and their submissions. It never tracks location or activity outside this site.</p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header d-flex"><strong className="me-auto">Online now ({rows.length})</strong>{hidden > 0 && <span className="small text-muted">{hidden} {hidden === 1 ? 'student has' : 'students have'} hidden their status</span>}</div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead><tr><th>Student</th><th>Course</th><th>Viewing</th><th>Last activity</th></tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan="4" className="text-center text-muted py-5">No students are online right now.</td></tr>}
                  {rows.map((r) => (
                    <tr key={r.student.id}>
                      <td><i className="bi bi-circle-fill text-success me-2" style={{ fontSize: 8 }} aria-label="online" />{r.student.name}</td>
                      <td>{r.courseTitle || <span className="text-muted">–</span>}</td>
                      <td>{r.lessonTitle || <span className="text-muted">Browsing</span>}</td>
                      <td title={fmtDateTime(r.lastActivityAt)}>{sinceText(r.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card h-100"><div className="card-header fw-semibold">Activity feed</div><ActivityList items={feed} empty="Activity appears here as it happens." /></div>
        </div>
      </div>
      <p className="small mt-3"><Link to="/attendance">Manage attendance sessions</Link> · <Link to="/reports">Reports</Link></p>
    </>
  );
}
