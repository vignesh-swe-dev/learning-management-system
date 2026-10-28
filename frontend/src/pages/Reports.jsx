import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { bucketLabel, tzOffset } from '../utils/activity.js';

const PERIODS = [['daily', 'Daily (14 days)'], ['weekly', 'Weekly (12 weeks)'], ['monthly', 'Monthly (12 months)']];

/* Themed tooltip matching CSS vars */
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
        <div key={p.dataKey} style={{ color: p.fill || p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

export default function Reports() {
  const { user } = useAuth();
  const staff = user.role !== 'student';
  const [period, setPeriod] = useState('daily');
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState([]);
  const [buckets, setBuckets] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [completion, setCompletion] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (staff) api.get('/courses', { params: { limit: 100, ...(user.role === 'instructor' ? { mine: true } : {}) } }).then((r) => setCourses(r.data.data)).catch(() => {});
  }, [staff, user.role]);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = { period, tzOffset: tzOffset(), ...(courseId ? { courseId } : {}) };
      const requests = [api.get('/tracking/reports', { params }), api.get('/attendance/reports', { params: courseId ? { courseId } : {} })];
      if (staff) requests.push(api.get('/tracking/dashboard', { params: { allCourses: true } }));
      const [r, a, d] = await Promise.all(requests);
      setBuckets(r.data.buckets); setAttendance(a.data);
      if (d) setCompletion(courseId ? d.data.courses.filter((c) => c.courseId === courseId) : d.data.courses);
    } catch (e) { setError(errorMessage(e)); }
  }, [period, courseId, staff]);
  useEffect(() => { load(); }, [load]);

  const rows = (buckets || []).map((b) => ({ ...b, label: bucketLabel(b.start, period) }));

  return (
    <>
      <div className="d-flex flex-wrap gap-2 align-items-end mb-4">
        <h1 className="h4 mb-0 me-auto fw-semibold">Reports &amp; analytics</h1>
        <div>
          <label className="form-label small mb-1" htmlFor="rp-period">Period</label>
          <select id="rp-period" className="form-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {staff && (
          <div>
            <label className="form-label small mb-1" htmlFor="rp-course">Course</label>
            <select id="rp-course" className="form-select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {/* Activity chart */}
      <div className="card mb-4">
        <div className="card-header">{staff ? 'Learning activity' : 'Your learning activity'}</div>
        <div className="card-body">
          {!buckets
            ? <div className="skeleton" style={{ height: 260 }} />
            : (
              <div style={{ width: '100%', height: 280 }} role="img" aria-label={`Learning activity, ${period}`}>
                <ResponsiveContainer>
                  <BarChart data={rows} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--lms-chart-grid)" />
                    <XAxis dataKey="label" fontSize={12} tick={{ fill: 'var(--lms-chart-text)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} fontSize={12} tick={{ fill: 'var(--lms-chart-text)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ThemedTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--lms-text-muted)' }} />
                    <Bar dataKey="lessonsCompleted"  name="Lessons completed" fill="var(--lms-chart-accent)"  radius={[3,3,0,0]} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                    <Bar dataKey="submissions"       name="Submissions"        fill="var(--lms-chart-primary)" radius={[3,3,0,0]} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                    <Bar dataKey="quizAttempts"      name="Quiz attempts"      fill="var(--lms-chart-purple)"  radius={[3,3,0,0]} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                    <Bar dataKey="attendanceJoins"   name="Session joins"      fill="var(--lms-chart-grey)"    radius={[3,3,0,0]} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          {buckets && (
            <details className="mt-3">
              <summary className="small" style={{ cursor: 'pointer', color: 'var(--lms-primary)' }}>View as a table</summary>
              <div className="table-responsive mt-2">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>{period === 'daily' ? 'Day' : period === 'weekly' ? 'Week starting' : 'Month'}</th>
                      <th>Lessons</th><th>Submissions</th><th>Quizzes</th><th>Joins</th>
                      {staff && <th>Active students</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map((b) => (
                      <tr key={b.start}>
                        <td>{b.label}</td><td>{b.lessonsCompleted}</td><td>{b.submissions}</td>
                        <td>{b.quizAttempts}</td><td>{b.attendanceJoins}</td>
                        {staff && <td>{b.activeStudents}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Course completion table */}
      {staff && (
        <div className="card mb-4">
          <div className="card-header">Course completion</div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr><th>Course</th><th>Enrolled</th><th>Completed</th><th style={{ minWidth: 180 }}>Average progress</th></tr>
              </thead>
              <tbody>
                {completion.length === 0 && <tr><td colSpan="4" className="text-center py-4" style={{ color: 'var(--lms-text-muted)' }}>No course data yet.</td></tr>}
                {completion.map((c) => (
                  <tr key={c.courseId}>
                    <td className="fw-medium">{c.title}</td>
                    <td className="font-tabular">{c.enrolled}</td>
                    <td className="font-tabular">{c.completed} ({c.completionRate}%)</td>
                    <td><ProgressBar percent={c.averageProgress} label={`${c.title} average progress`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance summary */}
      <div className="card">
        <div className="card-header">Attendance summary</div>
        {!attendance
          ? <div className="card-body"><div className="skeleton" style={{ height: 80 }} /></div>
          : attendance.courses.length === 0
          ? <div className="card-body" style={{ color: 'var(--lms-text-muted)' }}>No attendance has been recorded yet.</div>
          : staff
          ? attendance.courses.map((c) => (
            <div key={c.course._id} className="border-top">
              <div className="p-3 d-flex">
                <strong className="me-auto">{c.course.title}</strong>
                <span className="small" style={{ color: 'var(--lms-text-muted)' }}>{c.sessionCount} sessions · average {c.averagePercent === null ? '–' : `${c.averagePercent}%`}</span>
              </div>
              {c.students.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead><tr><th>Student</th><th>Attended</th><th>Attendance</th><th>Time in sessions</th></tr></thead>
                    <tbody>
                      {c.students.map((s) => (
                        <tr key={s.student._id}>
                          <td>{s.student.name}</td>
                          <td className="font-tabular">{s.attended} of {s.sessions}</td>
                          <td className="font-tabular">{s.percent === null ? '–' : `${s.percent}%`}</td>
                          <td className="font-tabular">{s.totalMinutes} min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
          : attendance.courses.map((c) => (
            <div key={c.course._id} className="p-3 border-top d-flex">
              <strong className="me-auto">{c.course.title}</strong>
              <span className="font-tabular small" style={{ color: 'var(--lms-text-muted)' }}>
                {c.percent === null ? 'No sessions yet' : `${c.percent}% (${c.attended} of ${c.sessionCount}) · ${c.totalMinutes} min`}
              </span>
            </div>
          ))
        }
      </div>
    </>
  );
}
