import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import CourseCard from '../components/CourseCard.jsx';
import Pagination from '../components/Pagination.jsx';

const LIMIT = 9;

export default function Courses() {
  const { user } = useAuth();
  const staff = user.role === 'admin' || user.role === 'instructor';
  const [filters, setFilters] = useState({ q: '', category: '', level: '', sort: 'newest', status: '', mine: false });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, pages: 1, categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrollingId, setEnrollingId] = useState(null);

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    const params = { page, limit: LIMIT, sort: applied.sort };
    ['q', 'category', 'level', 'status'].forEach((k) => { if (applied[k]) params[k] = applied[k]; });
    if (applied.mine) params.mine = true;
    api.get('/courses', { params })
      .then((res) => live && setResult(res.data))
      .catch((err) => live && setError(errorMessage(err)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [applied, page]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const apply = (e) => { e.preventDefault(); setPage(1); setApplied(filters); };

  const enroll = async (course) => {
    setEnrollingId(course._id); setError('');
    try {
      await api.post('/enrollments', { courseId: course._id });
      setResult((r) => ({ ...r, data: r.data.map((c) => (c._id === course._id ? { ...c, isEnrolled: true } : c)) }));
    } catch (err) { setError(errorMessage(err)); } finally { setEnrollingId(null); }
  };

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0 me-auto">Courses</h1>
        {staff && <Link to="/courses/new" className="btn btn-primary"><i className="bi bi-plus-lg" aria-hidden="true" /> New course</Link>}
      </div>

      <form className="card card-body mb-4" onSubmit={apply} role="search">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-4">
            <label className="form-label small" htmlFor="f-q">Search</label>
            <input id="f-q" className="form-control" placeholder="Title, topic or category" value={filters.q} onChange={set('q')} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="f-cat">Category</label>
            <select id="f-cat" className="form-select" value={filters.category} onChange={set('category')}>
              <option value="">All</option>
              {result.categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="f-level">Level</label>
            <select id="f-level" className="form-select" value={filters.level} onChange={set('level')}>
              <option value="">All</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="f-sort">Sort by</label>
            <select id="f-sort" className="form-select" value={filters.sort} onChange={set('sort')}>
              <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title</option>
            </select>
          </div>
          {staff && (
            <div className="col-6 col-md-2">
              <label className="form-label small" htmlFor="f-status">Status</label>
              <select id="f-status" className="form-select" value={filters.status} onChange={set('status')}>
                <option value="">All</option><option value="published">Published</option><option value="draft">Draft</option>
              </select>
            </div>
          )}
          <div className="col-12 col-md-auto d-flex align-items-center gap-3">
            {staff && (
              <div className="form-check">
                <input id="f-mine" type="checkbox" className="form-check-input" checked={filters.mine} onChange={set('mine')} />
                <label className="form-check-label small" htmlFor="f-mine">{user.role === 'admin' ? 'Created by me' : 'My courses'}</label>
              </div>
            )}
            <button className="btn btn-primary">Apply</button>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="row g-3">
        {loading && [...Array(6)].map((_, i) => <div key={i} className="col-12 col-md-6 col-xl-4"><div className="skeleton" style={{ height: 300 }} /></div>)}
        {!loading && result.data.map((c) => (
          <div key={c._id} className="col-12 col-md-6 col-xl-4">
            <CourseCard course={c} canEnroll={user.role === 'student'} onEnroll={enroll} busy={enrollingId === c._id} />
          </div>
        ))}
      </div>

      {!loading && result.data.length === 0 && (
        <div className="card card-body text-center py-5 text-muted">
          <p className="mb-1">No courses match these filters.</p>
          {staff && <Link to="/courses/new">Create the first course</Link>}
        </div>
      )}
      <Pagination page={page} pages={result.pages} total={result.total} label="courses" onChange={setPage} />
    </>
  );
}
