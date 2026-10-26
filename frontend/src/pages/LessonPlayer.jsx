import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import LessonViewer from '../components/LessonViewer.jsx';
import ProgressBar from '../components/ProgressBar.jsx';

const ICONS = {
  video: 'bi-play-circle',
  pdf: 'bi-file-earmark-pdf',
  document: 'bi-file-earmark-text',
  image: 'bi-image',
  text: 'bi-card-text',
};
const SEND_EVERY_MS = 15000;

export default function LessonPlayer() {
  const { courseId, lessonId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const tracking = user.role === 'student';
  const { socket, readyCount } = useRealtime();

  const [outline, setOutline] = useState(null);
  const [progress, setProgress] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const watched = useRef(0);
  const lastTime = useRef(0);
  const lastSent = useRef(0);
  const videoEl = useRef(null);

  const loadProgress = useCallback(async () => {
    if (!tracking) return null;
    const { data } = await api.get(`/progress/${courseId}`);
    const next = { ...data, byLesson: Object.fromEntries(data.lessons.map((l) => [l.lessonId, l])) };
    setProgress(next);
    return next;
  }, [courseId, tracking]);

  useEffect(() => {
    api.get(`/courses/${courseId}`).then((r) => setOutline(r.data)).catch((e) => setError(errorMessage(e)));
  }, [courseId]);

  useEffect(() => {
    let live = true;
    setLesson(null); setError('');
    (async () => {
      try {
        const { data } = await api.get(`/lessons/${lessonId}/access`);
        if (!live) return;
        if (tracking) {
          await api.post(`/progress/lessons/${lessonId}`, {});
          const p = await loadProgress();
          watched.current = p?.byLesson[lessonId]?.watchedSec || 0;
          lastSent.current = Date.now();
        }
        if (live) setLesson(data.lesson);
      } catch (e) { if (live) setError(errorMessage(e)); }
    })();
    return () => { live = false; };
  }, [lessonId, tracking, loadProgress]);

  useEffect(() => {
    if (!tracking || !socket) return undefined;
    socket.emit('lesson:start', { lessonId });
    return () => { socket.emit('lesson:stop'); };
  }, [tracking, socket, lessonId, readyCount]);

  const send = useCallback(async (extra = {}) => {
    const body = { watchedSec: Math.floor(watched.current), ...extra };
    if (videoEl.current) body.positionSec = Math.floor(videoEl.current.currentTime);
    const res = await api.post(`/progress/lessons/${lessonId}`, body);
    await loadProgress();
    return res;
  }, [lessonId, loadProgress]);

  const flat = (outline?.modules || []).flatMap((m) => m.lessons);
  const index = flat.findIndex((l) => l._id === lessonId);
  const next = index >= 0 ? flat[index + 1] : null;
  const done = progress?.byLesson[lessonId]?.status === 'completed';

  const complete = async (thenGoNext) => {
    setBusy(true); setError('');
    try {
      await send({ completed: true });
      if (thenGoNext && next) navigate(`/courses/${courseId}/learn/${next._id}`);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const videoProps = tracking ? {
    ref: videoEl,
    onLoadedMetadata: (e) => {
      const pos = progress?.byLesson[lessonId]?.lastPositionSec;
      if (pos && pos < e.target.duration - 2) e.target.currentTime = pos;
      lastTime.current = e.target.currentTime;
    },
    onSeeking: (e) => { lastTime.current = e.target.currentTime; },
    onTimeUpdate: (e) => {
      const t = e.target.currentTime;
      const delta = t - lastTime.current;
      if (delta > 0 && delta < 2) watched.current += delta;
      lastTime.current = t;
      if (Date.now() - lastSent.current > SEND_EVERY_MS) { lastSent.current = Date.now(); send().catch(() => {}); }
    },
    onPause: () => { send().catch(() => {}); },
    onEnded: () => { complete(false); },
  } : undefined;

  if (error && !outline) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!outline) return <div className="skeleton" style={{ height: 300, borderRadius: 'var(--lms-radius-md)' }} />;

  return (
    <>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to={`/courses/${courseId}`}>{outline.course.title}</Link></li>
          <li className="breadcrumb-item active" aria-current="page">{lesson?.title || 'Lesson'}</li>
        </ol>
      </nav>

      {tracking && progress && (
        <div className="mb-3">
          <ProgressBar percent={progress.percent} label="Course progress" />
          <div className="small mt-1" style={{ color: 'var(--lms-text-muted)' }}>
            {progress.completed} of {progress.total} lessons complete
          </div>
          {progress.percent === 100 && (
            <div className="alert alert-success mt-2 mb-0 py-2" role="status">
              You have completed this course. Your certificate is in <Link to="/results">Results</Link>.
            </div>
          )}
        </div>
      )}
      {!tracking && <div className="alert alert-info py-2" role="status">Preview mode: progress is only recorded for students.</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="row g-3">
        {/* ── Content area ── */}
        <div className="col-lg-8">
          {!lesson && !error && <div className="skeleton" style={{ height: 320, borderRadius: 'var(--lms-radius-md)' }} />}
          {lesson && <LessonViewer lesson={lesson} videoProps={videoProps} />}
          {lesson && (
            <div className="d-flex gap-2 flex-wrap mt-3">
              {tracking && !done && (
                <button className="btn btn-primary" disabled={busy} onClick={() => complete(false)}>
                  {busy && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />}
                  Mark as complete
                </button>
              )}
              {tracking && !done && next && (
                <button className="btn btn-outline-primary" disabled={busy} onClick={() => complete(true)}>
                  Complete &amp; continue
                </button>
              )}
              {done && (
                <span className="badge text-bg-success align-self-center" style={{ fontSize: 13, padding: '6px 10px' }}>
                  <i className="bi bi-check-circle-fill me-1" aria-hidden="true" /> Completed
                </span>
              )}
              {next && (
                <Link
                  className="btn btn-outline-secondary btn-arrow ms-auto"
                  to={`/courses/${courseId}/learn/${next._id}`}
                >
                  Next lesson <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Lesson list sidebar ── */}
        <div className="col-lg-4">
          <div className="card lesson-list">
            <div className="card-header">Lessons</div>
            <div className="list-group list-group-flush">
              {outline.modules.map((m) => (
                <div key={m._id}>
                  <div className="list-group-item lesson-module-header">{m.title}</div>
                  {m.lessons.map((l) => {
                    const st = progress?.byLesson[l._id]?.status;
                    const isActive = l._id === lessonId;
                    return (
                      <Link
                        key={l._id}
                        to={`/courses/${courseId}/learn/${l._id}`}
                        aria-current={isActive ? 'true' : undefined}
                        className={`list-group-item list-group-item-action d-flex align-items-center gap-2${isActive ? ' active' : ''}`}
                      >
                        <i
                          className={`bi ${st === 'completed' ? 'bi-check-circle-fill text-success' : ICONS[l.type] || 'bi-file-earmark'}`}
                          aria-hidden="true"
                          style={{ fontSize: 15, flexShrink: 0 }}
                        />
                        <span className="flex-grow-1" style={{ fontSize: 13 }}>{l.title}</span>
                        {st === 'completed' && <span className="visually-hidden">(completed)</span>}
                        {l.locked && <i className="bi bi-lock" style={{ fontSize: 13, color: 'var(--lms-text-muted)' }} aria-label="Locked" />}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
