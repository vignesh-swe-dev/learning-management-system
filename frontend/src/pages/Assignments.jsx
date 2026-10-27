import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Pagination from '../components/Pagination.jsx';
import { fmtDateTime, tomorrowEvening } from '../utils/format.js';

const STATE = {
  pending: ['text-bg-primary', 'To do'], submitted: ['text-bg-info', 'Submitted'], graded: ['text-bg-success', 'Graded'],
  overdue: ['text-bg-warning', 'Overdue'], closed: ['text-bg-secondary', 'Closed'],
};
const BLANK = { courseId: '', title: '', description: '', dueAt: tomorrowEvening(), maxMarks: 100, allowLate: false, latePenaltyPercent: 0 };

export default function Assignments() {
  const { user } = useAuth();
  const staff = user.role !== 'student';
  const [params] = useSearchParams();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.get('/assignments', { params: { page, limit: 10, courseId: params.get('courseId') || undefined } })
      .then((r) => live && setResult(r.data)).catch((e) => live && setError(errorMessage(e))).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [page, params, reload]);

  useEffect(() => {
    if (staff && showForm && courses.length === 0) {
      api.get('/courses', { params: { limit: 100, ...(user.role === 'instructor' ? { mine: true } : {}) } }).then((r) => setCourses(r.data.data));
    }
  }, [staff, showForm, courses.length, user.role]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/assignments', { ...form, dueAt: new Date(form.dueAt).toISOString(), maxMarks: Number(form.maxMarks), latePenaltyPercent: Number(form.latePenaltyPercent) });
      setShowForm(false); setForm(BLANK); setReload((n) => n + 1);
    } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0 me-auto">Assignments</h1>
        {staff && <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : <><i className="bi bi-plus-lg" aria-hidden="true" /> New assignment</>}</button>}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {showForm && (
        <form className="card card-body mb-4" onSubmit={save}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="a-course">Course</label>
              <select id="a-course" className="form-select" required value={form.courseId} onChange={set('courseId')}>
                <option value="">Choose a course</option>
                {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="a-title">Title</label>
              <input id="a-title" className="form-control" required minLength={3} value={form.title} onChange={set('title')} />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="a-desc">Instructions</label>
              <textarea id="a-desc" rows="4" className="form-control" required minLength={5} value={form.description} onChange={set('description')} />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="a-due">Deadline</label>
              <input id="a-due" type="datetime-local" className="form-control" required value={form.dueAt} onChange={set('dueAt')} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label" htmlFor="a-marks">Total marks</label>
              <input id="a-marks" type="number" min="1" className="form-control" required value={form.maxMarks} onChange={set('maxMarks')} />
            </div>
            <div className="col-6 col-md-3 d-flex align-items-end">
              <div className="form-check"><input id="a-late" type="checkbox" className="form-check-input" checked={form.allowLate} onChange={set('allowLate')} /><label className="form-check-label" htmlFor="a-late">Accept late work</label></div>
            </div>
            {form.allowLate && (
              <div className="col-md-3">
                <label className="form-label" htmlFor="a-pen">Late penalty (%)</label>
                <input id="a-pen" type="number" min="0" max="100" className="form-control" value={form.latePenaltyPercent} onChange={set('latePenaltyPercent')} />
              </div>
            )}
          </div>
          <div className="mt-3"><button className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create assignment'}</button></div>
        </form>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead><tr><th>Assignment</th><th>Course</th><th>Due</th><th>{staff ? 'Submissions' : 'Status'}</th></tr></thead>
            <tbody>
              {loading && [...Array(4)].map((_, i) => <tr key={i}><td colSpan="4"><div className="skeleton" style={{ height: 18 }} /></td></tr>)}
              {!loading && result.data.length === 0 && <tr><td colSpan="4" className="text-center text-muted py-5">{staff ? 'No assignments yet. Create one to get started.' : 'No assignments in your courses yet.'}</td></tr>}
              {!loading && result.data.map((a) => (
                <tr key={a._id}>
                  <td><Link to={`/assignments/${a._id}`}>{a.title}</Link></td>
                  <td>{a.course?.title}</td>
                  <td>{fmtDateTime(a.dueAt)}</td>
                  <td>{staff
                    ? <span>{a.submissionCount} {a.ungradedCount > 0 && <span className="badge text-bg-warning ms-1">{a.ungradedCount} to grade</span>}</span>
                    : <span className={`badge ${STATE[a.state][0]}`}>{STATE[a.state][1]}{a.state === 'graded' && a.submission ? ` · ${a.submission.marks}/${a.maxMarks}` : ''}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pages={result.pages} total={result.total} label="assignments" onChange={setPage} />
    </>
  );
}
