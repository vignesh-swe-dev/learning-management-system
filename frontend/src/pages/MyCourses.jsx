import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { assetUrl, errorMessage } from '../services/api.js';
import ProgressBar from '../components/ProgressBar.jsx';

export default function MyCourses() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/enrollments/my-courses').then((r) => setItems(r.data.data)).catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <>
      <h1 className="h4 mb-4">My courses</h1>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!items && !error && <div className="skeleton" style={{ height: 120 }} />}
      {items && items.length === 0 && (
        <div className="card card-body text-center py-5 text-muted">
          <p className="mb-2">You are not enrolled in any courses yet.</p>
          <div><Link to="/courses" className="btn btn-primary">Browse courses</Link></div>
        </div>
      )}
      <div className="row g-3">
        {items?.map((e) => (
          <div key={e._id} className="col-12 col-md-6 col-xl-4">
            <div className="card h-100 overflow-hidden">
              {e.course.thumbnail && <img src={assetUrl(e.course.thumbnail)} alt="" style={{ height: 120, objectFit: 'cover' }} />}
              <div className="card-body d-flex flex-column">
                <h2 className="h6">{e.course.title}</h2>
                <p className="small text-muted">{(e.course.instructors || []).map((i) => i.name).join(', ')}</p>
                <ProgressBar percent={e.progress.percent} label={`${e.course.title} progress`} />
                <p className="small text-muted mb-3">{e.progress.completed} of {e.progress.total} lessons{e.status === 'completed' ? ' · Completed' : ''}</p>
                <Link to={`/courses/${e.course._id}`} className="btn btn-primary btn-sm mt-auto align-self-start">Continue</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
