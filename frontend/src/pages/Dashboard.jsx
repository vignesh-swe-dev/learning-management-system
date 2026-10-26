import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLiveRefresh } from '../hooks/useSocketEvent.js';
import { useLinkedStudents } from '../hooks/useLinkedStudents.js';
import Kpi from '../components/Kpi.jsx';
import ActivityList from '../components/ActivityList.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { bucketLabel, startOfToday, tzOffset } from '../utils/activity.js';
import { fmtDateTime } from '../utils/format.js';

/* Read chart colours from CSS tokens at render time so they follow the theme */
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const pct = (v) => (v === null || v === undefined ? '–' : `${v}%`);

/* ── Shared chart wrapper ──────────────────────────────────── */
function ChartTooltipStyle() {
  return null; // Recharts tooltip styled via CSS vars below
}

/* Custom tooltip that follows theme colours */
const ThemedTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--lms-chart-tooltip-bg)',
      border: '1px solid var(--lms-chart-tooltip-border)',
      borderRadius: 'var(--lms-radius-sm)',
      padding: '8px 12px',
      fontSize: 12,
      boxShadow: 'var(--lms-shadow-md)',
      color: 'var(--lms-text)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

/* ── Daily line chart ──────────────────────────────────────── */
function DailyChart({ data, series }) {
  const rows = data.map((b) => ({ ...b, label: bucketLabel(b.start, 'daily') }));
  return (
    <div style={{ width: '100%', height: 240 }} role="img" aria-label="Activity over the last 7 days">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--lms-chart-grid)" />
          <XAxis dataKey="label" fontSize={12} tick={{ fill: 'var(--lms-chart-text)' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} fontSize={12} tick={{ fill: 'var(--lms-chart-text)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ThemedTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--lms-text-muted)' }} />
          {series.map(([key, name, cssVarName]) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stroke={`var(${cssVarName})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={600}
              animationEasing="ease-out"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Staff dashboard ──────────────────────────────────────── */
function StaffDashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api
      .get('/tracking/dashboard', { params: { since: startOfToday().toISOString(), tzOffset: tzOffset() } })
      .then((r) => { setD(r.data); setError(''); })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useLiveRefresh(['dashboard:updated'], load);

  if (error) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!d) return (
    <div className="row g-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="col-6 col-lg-3 stagger-item">
          <div className="skeleton" style={{ height: 90, borderRadius: 'var(--lms-radius-md)' }} />
        </div>
      ))}
    </div>
  );

  const att = d.todaysAttendance;
  return (
    <>
      <div className="row g-3 mb-4">
        {[
          { label: 'Registered students', value: d.totalStudents, icon: 'bi-people' },
          { label: 'Active now', value: d.activeStudents, icon: 'bi-broadcast', hint: d.hiddenActiveCount ? `+${d.hiddenActiveCount} hidden` : undefined },
          { label: 'Courses · lessons', value: `${d.totalCourses} · ${d.totalLessons}`, icon: 'bi-journal-text' },
          { label: 'Course completion', value: pct(d.overallCompletionRate), icon: 'bi-trophy' },
          { label: "Today's attendance", value: pct(att.percent), icon: 'bi-person-check', hint: att.sessions ? `${att.present} of ${att.expected} in ${att.sessions} session${att.sessions === 1 ? '' : 's'}` : 'No sessions today' },
          { label: 'Open sessions', value: d.openSessions, icon: 'bi-camera-video' },
          { label: 'Assignments to grade', value: d.pendingAssignments, icon: 'bi-pencil-square' },
        ].map((kpi, i) => (
          <div key={kpi.label} className="col-6 col-lg-3 stagger-item">
            <Kpi {...kpi} />
          </div>
        ))}
        <div className="col-6 col-lg-3 stagger-item">
          <Link to="/live" className="text-decoration-none d-block h-100">
            <Kpi label="Live activity" value="Open" icon="bi-activity" />
          </Link>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header">Completion by course</div>
            <div className="card-body">
              {d.courses.length === 0
                ? <p className="mb-0" style={{ color: 'var(--lms-text-muted)' }}>No courses yet.</p>
                : (
                  <div style={{ width: '100%', height: 260 }} role="img" aria-label="Completion rate and average progress by course">
                    <ResponsiveContainer>
                      <BarChart
                        data={d.courses.map((c) => ({ ...c, name: c.title.length > 16 ? `${c.title.slice(0, 15)}…` : c.title }))}
                        margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--lms-chart-grid)" />
                        <XAxis dataKey="name" fontSize={12} tick={{ fill: 'var(--lms-chart-text)' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} unit="%" fontSize={12} tick={{ fill: 'var(--lms-chart-text)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ThemedTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--lms-text-muted)' }} />
                        <Bar dataKey="completionRate" name="Completed course" fill="var(--lms-chart-accent)" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                        <Bar dataKey="averageProgress" name="Average progress" fill="var(--lms-chart-primary)" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header">Last 7 days</div>
            <div className="card-body">
              <DailyChart
                data={d.dailyActivity}
                series={[
                  ['lessonsCompleted', 'Lessons completed', '--lms-chart-accent'],
                  ['submissions', 'Submissions', '--lms-chart-primary'],
                  ['activeStudents', 'Active students', '--lms-chart-grey'],
                ]}
              />
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex">
              <strong className="me-auto">Recent activity</strong>
              <Link to="/live" className="small" style={{ color: 'var(--lms-primary)' }}>See live view</Link>
            </div>
            <ActivityList items={d.recentActivity} empty="Activity appears here as students learn." />
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Student view ─────────────────────────────────────────── */
function StudentView({ studentId, name }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api
      .get('/tracking/dashboard', { params: { studentId, tzOffset: tzOffset() } })
      .then((r) => { setD(r.data); setError(''); })
      .catch((e) => setError(errorMessage(e)));
  }, [studentId]);
  useLiveRefresh(['attendance:closed', 'notification:new'], load);

  if (error) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!d) return <div className="skeleton" style={{ height: 200 }} />;

  return (
    <>
      <div className="row g-3 mb-4">
        {[
          { label: 'Courses', value: d.enrolledCourses, icon: 'bi-journal-text' },
          { label: 'Average progress', value: pct(d.averageProgress), icon: 'bi-bar-chart' },
          { label: 'Attendance', value: pct(d.attendance.percent), icon: 'bi-person-check', hint: d.attendance.sessions ? `${d.attendance.attended} of ${d.attendance.sessions} sessions` : 'No sessions yet' },
          { label: 'Assignments to do', value: d.pendingAssignmentCount, icon: 'bi-pencil-square' },
        ].map((kpi) => (
          <div key={kpi.label} className="col-6 col-lg-3 stagger-item">
            <Kpi {...kpi} />
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">Course progress</div>
            <div className="card-body">
              {d.courses.length === 0 && <p style={{ color: 'var(--lms-text-muted)' }} className="mb-0">{name ? `${name} is` : 'You are'} not enrolled in any courses yet.</p>}
              {d.courses.map((c) => (
                <div key={c.courseId} className="mb-3">
                  <div className="small mb-1">{c.title}</div>
                  <ProgressBar percent={c.percent} label={`${c.title} progress`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">Last 7 days</div>
            <div className="card-body">
              <DailyChart
                data={d.dailyActivity}
                series={[
                  ['lessonsCompleted', 'Lessons completed', '--lms-chart-accent'],
                  ['submissions', 'Submissions', '--lms-chart-primary'],
                ]}
              />
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">Coming up</div>
            <ul className="list-group list-group-flush">
              {d.pendingAssignments.length === 0 && <li className="list-group-item" style={{ color: 'var(--lms-text-muted)', fontSize: 13 }}>Nothing due. Nice work.</li>}
              {d.pendingAssignments.map((a) => (
                <li key={a._id} className="list-group-item d-flex justify-content-between">
                  {name ? <span>{a.title}</span> : <Link to={`/assignments/${a._id}`}>{a.title}</Link>}
                  <span className="small" style={{ color: 'var(--lms-text-muted)' }}>Due {fmtDateTime(a.dueAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">Recently completed</div>
            <ul className="list-group list-group-flush">
              {d.recentCompletions.length === 0 && <li className="list-group-item" style={{ color: 'var(--lms-text-muted)', fontSize: 13 }}>No lessons completed yet.</li>}
              {d.recentCompletions.map((r, i) => (
                <li key={i} className="list-group-item d-flex justify-content-between">
                  <span>{r.lesson} <span style={{ color: 'var(--lms-text-muted)' }}>· {r.course}</span></span>
                  <span className="small" style={{ color: 'var(--lms-text-muted)' }}>{fmtDateTime(r.completedAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Parent view ──────────────────────────────────────────── */
function ParentView() {
  const students = useLinkedStudents();
  const [id, setId] = useState('');
  if (!students) return <div className="skeleton" style={{ height: 120 }} />;
  if (students.length === 0) {
    return (
      <div className="empty-state card card-body">
        <i className="bi bi-people" aria-hidden="true" />
        <p>No students are linked to your account yet. Ask the school administrator to link them.</p>
      </div>
    );
  }
  const chosen = id || students[0]._id;
  return (
    <>
      <div className="mb-3" style={{ maxWidth: 320 }}>
        <label className="form-label small" htmlFor="p-student">Student</label>
        <select id="p-student" className="form-select" value={chosen} onChange={(e) => setId(e.target.value)}>
          {students.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
      </div>
      <StudentView key={chosen} studentId={chosen} name={students.find((s) => s._id === chosen)?.name} />
    </>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  return (
    <>
      <h1 className="h4 mb-4 fw-semibold">
        {user.role === 'student'
          ? `Welcome back, ${user.name.split(' ')[0]} 👋`
          : user.role === 'parent'
          ? 'Your students'
          : 'Dashboard'}
      </h1>
      {(user.role === 'admin' || user.role === 'instructor') && <StaffDashboard />}
      {user.role === 'student' && <StudentView studentId={undefined} />}
      {user.role === 'parent' && <ParentView />}
    </>
  );
}
