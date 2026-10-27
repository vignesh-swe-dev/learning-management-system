import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Pagination from '../components/Pagination.jsx';
import { fmtDate, fmtDateTime } from '../utils/format.js';

export default function Results() {
  const { user } = useAuth();
  const role = user.role;
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState({ studentId: '', courseId: '', type: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, pages: 1, averagePercent: null });
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role === 'parent') {
      Promise.all((user.linkedStudents || []).map((sid) => api.get(`/users/${sid}`).then((r) => r.data.user)))
        .then((list) => { setStudents(list); if (list[0]) setFilters((f) => ({ ...f, studentId: list[0].id || list[0]._id })); }).catch((e) => setError(errorMessage(e)));
    }
    if (role === 'admin' || role === 'instructor') api.get('/courses', { params: { limit: 100, ...(role === 'instructor' ? { mine: true } : {}) } }).then((r) => setCourses(r.data.data)).catch(() => {});
    if (role === 'student') api.get('/certificates/my').then((r) => setCerts(r.data.data)).catch(() => {});
  }, [role, user.linkedStudents]);

  const parentNeedsChoice = role === 'parent' && !filters.studentId;
  useEffect(() => {
    if (parentNeedsChoice) { setLoading(false); return undefined; }
    let live = true;
    setLoading(true);
    const params = { page, limit: 15 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/results', { params }).then((r) => live && setResult(r.data)).catch((e) => live && setError(errorMessage(e))).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [filters, page, parentNeedsChoice]);

  const set = (k) => (e) => { setPage(1); setFilters({ ...filters, [k]: e.target.value }); };
  const showStudent = role === 'admin' || role === 'instructor';

  return (
    <>
      <h1 className="h4 mb-3">Results</h1>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="row g-2 mb-3">
        {role === 'parent' && (
          <div className="col-md-4"><label className="form-label small" htmlFor="r-student">Student</label>
            <select id="r-student" className="form-select" value={filters.studentId} onChange={set('studentId')}>{students.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
        )}
        {showStudent && (
          <div className="col-md-4"><label className="form-label small" htmlFor="r-course">Course</label>
            <select id="r-course" className="form-select" value={filters.courseId} onChange={set('courseId')}><option value="">All courses</option>{courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}</select></div>
        )}
        <div className="col-md-3"><label className="form-label small" htmlFor="r-type">Type</label>
          <select id="r-type" className="form-select" value={filters.type} onChange={set('type')}><option value="">Assignments and quizzes</option><option value="assignment">Assignments</option><option value="quiz">Quizzes and exams</option></select></div>
        {result.averagePercent !== null && <div className="col-md-3 d-flex align-items-end"><span className="fs-5">Average: <strong>{result.averagePercent}%</strong></span></div>}
      </div>

      <div className="card mb-4">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr>{showStudent && <th>Student</th>}<th>Item</th><th>Course</th><th>Score</th><th>Date</th></tr></thead>
            <tbody>
              {loading && [...Array(4)].map((_, i) => <tr key={i}><td colSpan="5"><div className="skeleton" style={{ height: 18 }} /></td></tr>)}
              {!loading && result.data.length === 0 && <tr><td colSpan="5" className="text-center text-muted py-5">No marks yet. Graded assignments and quizzes appear here.</td></tr>}
              {!loading && result.data.map((r, i) => (
                <tr key={i}>
                  {showStudent && <td>{r.student?.name}</td>}
                  <td>{r.title} <span className="badge text-bg-light border ms-1">{r.type === 'quiz' ? (r.isExam ? 'Exam' : 'Quiz') : 'Assignment'}</span>{r.late && <span className="badge text-bg-warning ms-1">Late</span>}</td>
                  <td>{r.course?.title}</td>
                  <td>{r.score} / {r.maxScore} <span className="text-muted">({r.percent}%)</span>{r.status === 'pending_review' && <span className="badge text-bg-warning ms-2">Pending review</span>}</td>
                  <td>{fmtDateTime(r.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pages={result.pages} total={result.total} label="results" onChange={setPage} />

      {role === 'student' && (
        <>
          <h2 className="h5 mt-4 mb-3">Certificates</h2>
          {certs.length === 0 && <div className="card card-body text-muted">Finish every lesson in a course to earn its certificate.</div>}
          <div className="row g-3">
            {certs.map((c) => (
              <div key={c._id} className="col-md-6 col-xl-4"><div className="card card-body">
                <i className="bi bi-patch-check-fill fs-3 text-accent" aria-hidden="true" />
                <strong>{c.course?.title}</strong>
                <span className="small text-muted">Issued {fmtDate(c.issuedAt)}</span>
                <span className="small">ID <code>{c.verificationId}</code></span>
                <Link to={`/verify/${c.verificationId}`} className="small">Open verification page</Link>
              </div></div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
