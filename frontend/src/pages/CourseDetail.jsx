import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { assetUrl, errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { fmtDateTime } from '../utils/format.js';

const ICONS = { video: 'bi-play-circle', pdf: 'bi-file-earmark-pdf', document: 'bi-file-earmark-text', image: 'bi-image', text: 'bi-card-text' };
const fmtDuration = (s) => (s ? `${Math.max(1, Math.round(s / 60))} min` : '');

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [work, setWork] = useState({ assignments: [], quizzes: [] });

  const load = useCallback(() => {
    api.get(`/courses/${id}`).then(async (r) => {
      setData(r.data);
      const { canSeeContent, isEnrolled } = r.data.access;
      if (isEnrolled) {
        api.get(`/progress/${id}`).then((p) => setProgress({ ...p.data, byLesson: Object.fromEntries(p.data.lessons.map((l) => [l.lessonId, l])) })).catch(() => {});
      } else setProgress(null);
      if (canSeeContent) {
        const [a, q] = await Promise.all([api.get('/assignments', { params: { courseId: id } }), api.get('/quizzes', { params: { courseId: id } })]);
        setWork({ assignments: a.data.data, quizzes: q.data.data });
      } else setWork({ assignments: [], quizzes: [] });
    }).catch((e) => setError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); load(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const enroll = () => run(() => api.post('/enrollments', { courseId: id }));
  const drop = () => window.confirm('Drop this course? You can enroll again later.')
    && run(async () => { await api.patch(`/enrollments/${data.access.enrollmentId}`, { status: 'dropped' }); });

  if (error && !data) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!data) return <div className="skeleton" style={{ height: 240 }} />;

  const { course, modules, access } = data;
  const lessonTotal = modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <>
      <div className="card overflow-hidden mb-4">
        <div className="row g-0">
          {course.thumbnail && <div className="col-md-4"><img src={assetUrl(course.thumbnail)} alt="" className="w-100 h-100" style={{ objectFit: 'cover', maxHeight: 260 }} /></div>}
          <div className="col">
            <div className="card-body">
              <div className="d-flex gap-1 flex-wrap mb-2">
                <span className="badge text-bg-light border">{course.category}</span>
                <span className="badge text-bg-light border text-capitalize">{course.level}</span>
                {course.status === 'draft' && <span className="badge text-bg-warning">Draft</span>}
              </div>
              <h1 className="h3">{course.title}</h1>
              <p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{course.description}</p>
              <p className="small text-muted">
                {course.instructors.map((i) => i.name).join(', ')} · {lessonTotal} {lessonTotal === 1 ? 'lesson' : 'lessons'}
                {course.durationHours ? ` · ${course.durationHours} h` : ''}
              </p>
              <div className="d-flex gap-2">
                {user.role === 'student' && !access.isEnrolled && course.status === 'published' && (
                  <button className="btn btn-primary" disabled={busy} onClick={enroll}>{busy ? 'Enrolling…' : 'Enroll in this course'}</button>
                )}
                {access.isEnrolled && <button className="btn btn-outline-secondary" disabled={busy} onClick={drop}>Drop course</button>}
                {access.canManage && <Link to={`/courses/${id}/edit`} className="btn btn-outline-primary">Edit course</Link>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {progress && (
        <div className="card card-body mb-4">
          <ProgressBar percent={progress.percent} label="Your progress" />
          <div className="small text-muted mt-1">{progress.completed} of {progress.total} lessons complete</div>
        </div>
      )}

      <h2 className="h5 mb-3">Course content</h2>
      {modules.length === 0 && <div className="card card-body text-muted">No lessons have been added yet.</div>}
      {modules.map((m) => (
        <div key={m._id} className="card mb-3">
          <div className="card-header fw-semibold">{m.title}</div>
          <ul className="list-group list-group-flush">
            {m.lessons.length === 0 && <li className="list-group-item text-muted small">No lessons in this module yet.</li>}
            {m.lessons.map((l) => (
              <li key={l._id} className="list-group-item d-flex align-items-center gap-3">
                <i className={`bi ${ICONS[l.type] || 'bi-file-earmark'} fs-5 text-accent`} aria-hidden="true" />
                <span className="me-auto">{l.title} <span className="small text-muted ms-1">{fmtDuration(l.durationSec)}</span></span>
                {progress?.byLesson[l._id]?.status === 'completed' && <span className="badge text-bg-success"><i className="bi bi-check2" aria-hidden="true" /> Done</span>}
                {l.locked
                  ? <span className="small text-muted"><i className="bi bi-lock" aria-hidden="true" /> Enroll to open</span>
                  : <Link className="btn btn-outline-primary btn-sm" to={`/courses/${id}/learn/${l._id}`}>Open</Link>}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {access.canSeeContent && <div className="mt-3"><Link to={`/courses/${id}/discussions`} className="btn btn-outline-primary btn-sm"><i className="bi bi-chat-square-text me-1" aria-hidden="true" />Discussions</Link></div>}

      {access.canSeeContent && (
        <div className="row g-3 mt-2">
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header d-flex align-items-center"><strong className="me-auto">Assignments</strong>{access.canManage && <Link to="/assignments" className="small">Manage</Link>}</div>
              <ul className="list-group list-group-flush">
                {work.assignments.length === 0 && <li className="list-group-item text-muted small">No assignments yet.</li>}
                {work.assignments.map((a) => (
                  <li key={a._id} className="list-group-item d-flex justify-content-between gap-2">
                    <Link to={`/assignments/${a._id}`}>{a.title}</Link><span className="small text-muted text-nowrap">Due {fmtDateTime(a.dueAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header d-flex align-items-center"><strong className="me-auto">Quizzes and exams</strong>{access.canManage && <Link to={`/quizzes/new?courseId=${id}`} className="small">New quiz</Link>}</div>
              <ul className="list-group list-group-flush">
                {work.quizzes.length === 0 && <li className="list-group-item text-muted small">No quizzes yet.</li>}
                {work.quizzes.map((q) => (
                  <li key={q._id} className="list-group-item d-flex justify-content-between gap-2">
                    <Link to={`/quizzes/${q._id}`}>{q.title}{q.isExam && <span className="badge text-bg-dark ms-2">Exam</span>}</Link>
                    <span className="small text-muted text-nowrap">{q.questionCount} questions</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
