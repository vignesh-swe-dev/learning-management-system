import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { fmtDateTime } from '../utils/format.js';

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/* ── Quiz taker ─────────────────────────────────────────── */
function Taker({ quizId, session, onFinished, onError }) {
  const { attempt, questions, skew } = session;
  const [answers, setAnswers] = useState(() => Object.fromEntries((session.draft || []).map((d) => [d.question, d.selectedOption ? { option: d.selectedOption } : { text: d.text || '' }])));
  const [saveState, setSaveState] = useState('');
  const dirty = useRef(false);
  const [left, setLeft] = useState(attempt.expiresAt ? new Date(attempt.expiresAt) - (Date.now() + skew) : null);
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);

  const submit = useCallback(async () => {
    if (sent.current) return;
    sent.current = true;
    setBusy(true);
    const payload = Object.entries(answers).map(([question, v]) =>
      v.option ? { question, selectedOption: v.option } : { question, text: v.text || '' }
    );
    try {
      const { data } = await api.post(`/quizzes/${quizId}/attempts/${attempt.id}/submit`, { answers: payload });
      onFinished(data.attempt);
    } catch (e) {
      sent.current = false; setBusy(false); onError(errorMessage(e));
      if (e.response?.status === 400 || e.response?.status === 409) onFinished(null);
    }
  }, [answers, attempt.id, quizId, onFinished, onError]);

  const toPayload = (a) => Object.entries(a).map(([question, v]) => (v.option ? { question, selectedOption: v.option } : { question, text: v.text || '' }));

  // Autosave 1.5s after the last change (answers are also sent in full on submit).
  useEffect(() => {
    if (!dirty.current) { dirty.current = true; return undefined; } // skip the initial render
    setSaveState('saving');
    const t = setTimeout(() => {
      api.put(`/quizzes/${quizId}/attempts/${attempt.id}/answers`, { answers: toPayload(answers) })
        .then(() => setSaveState('saved')).catch(() => setSaveState('failed'));
    }, 1500);
    return () => clearTimeout(t);
  }, [answers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (left === null) return undefined;
    const t = setInterval(() => setLeft(new Date(attempt.expiresAt) - (Date.now() + skew)), 1000);
    return () => clearInterval(t);
  }, [attempt.expiresAt, skew, left === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (left !== null && left <= 0) submit(); }, [left, submit]);

  const urgent = left !== null && left < 60000;

  return (
    <>
      {/* Sticky header with timer */}
      <div
        className="d-flex align-items-center mb-4 position-sticky py-2"
        style={{ top: 'var(--lms-topbar-height, 57px)', zIndex: 5, background: 'var(--lms-bg)' }}
      >
        <h2 className="h5 mb-0 me-auto fw-semibold">Attempt {attempt.attemptNumber}</h2>
        <span className="small me-3" role="status" style={{ color: 'var(--lms-text-muted)' }}>
          {saveState === 'saving' && 'Saving…'}{saveState === 'saved' && 'Answers saved'}{saveState === 'failed' && 'Couldn’t save — check your connection'}
        </span>
        {left !== null && (
          <span
            className={`badge d-flex align-items-center gap-1 quiz-timer${urgent ? ' urgent' : ''}`}
            style={{ fontSize: 15, padding: '6px 12px', background: urgent ? '#fef2f2' : 'var(--lms-primary-tint)', color: urgent ? '#ef4444' : 'var(--lms-primary)' }}
            role="timer"
            aria-live="off"
          >
            <i className="bi bi-stopwatch" aria-hidden="true" style={{ fontSize: 15 }} />
            {clock(left)}
          </span>
        )}
      </div>

      {questions.map((q, i) => (
        <fieldset key={q._id} className="card card-body mb-3" style={{ borderRadius: 'var(--lms-radius-md)' }}>
          <legend className="h6 float-none mb-3">
            {i + 1}. {q.text}{' '}
            <span className="small fw-normal" style={{ color: 'var(--lms-text-muted)' }}>({q.marks} {q.marks === 1 ? 'mark' : 'marks'})</span>
          </legend>
          {q.type === 'mcq'
            ? q.options.map((o) => (
              <div className="form-check mb-2" key={o._id}>
                <input
                  className="form-check-input"
                  type="radio"
                  name={q._id}
                  id={o._id}
                  checked={answers[q._id]?.option === o._id}
                  onChange={() => setAnswers({ ...answers, [q._id]: { option: o._id } })}
                />
                <label className="form-check-label" htmlFor={o._id}>{o.text}</label>
              </div>
            ))
            : (
              <textarea
                className="form-control"
                rows={5}
                aria-label={`Answer to question ${i + 1}`}
                value={answers[q._id]?.text || ''}
                onChange={(e) => setAnswers({ ...answers, [q._id]: { text: e.target.value } })}
              />
            )}
        </fieldset>
      ))}

      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={() => { if (window.confirm('Submit your answers now?')) submit(); }}
      >
        {busy && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />}
        {busy ? 'Submitting…' : 'Submit answers'}
      </button>
    </>
  );
}

/* ── Quiz page ──────────────────────────────────────────── */
export default function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [session, setSession] = useState(null);
  const [finished, setFinished] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() =>
    api.get(`/quizzes/${id}`).then((r) => setData(r.data)).catch((e) => setError(errorMessage(e))), [id]);
  useEffect(() => { load(); }, [load]);

  const start = async () => {
    setBusy(true); setError('');
    try {
      const res = await api.post(`/quizzes/${id}/attempts`);
      const serverNow = res.headers.date ? new Date(res.headers.date).getTime() : Date.now();
      setSession({ ...res.data, skew: serverNow - Date.now() });
      setFinished(null);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm('Delete this quiz and all attempts?')) return;
    try { await api.delete(`/quizzes/${id}`); navigate('/quizzes'); } catch (e) { setError(errorMessage(e)); }
  };

  if (error && !data) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!data) return <div className="skeleton" style={{ height: 240, borderRadius: 'var(--lms-radius-md)' }} />;
  const { quiz, canManage } = data;

  /* Manager view */
  if (canManage) {
    return (
      <>
        <nav aria-label="breadcrumb"><ol className="breadcrumb"><li className="breadcrumb-item"><Link to="/quizzes">Quizzes</Link></li><li className="breadcrumb-item active">{quiz.title}</li></ol></nav>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="card card-body mb-3">
          <h1 className="h4 mb-1">
            {quiz.title}
            {quiz.isExam && <span className="badge text-bg-dark ms-2">Exam</span>}
          </h1>
          <p className="mb-3" style={{ color: 'var(--lms-text-muted)', fontSize: 14 }}>
            {quiz.questions.length} questions · {quiz.questions.reduce((n, q) => n + q.marks, 0)} marks ·{' '}
            {quiz.timeLimitMin ? `${quiz.timeLimitMin} min` : 'Untimed'} ·{' '}
            {quiz.maxAttempts} attempt{quiz.maxAttempts === 1 ? '' : 's'} allowed
          </p>
          <div className="d-flex gap-2 flex-wrap">
            <Link className="btn btn-primary" to={`/quizzes/${id}/attempts`}>
              <i className="bi bi-graph-up me-1" aria-hidden="true" /> Attempts &amp; grading
            </Link>
            <Link className="btn btn-outline-secondary" to={`/quizzes/${id}/edit`}>
              <i className="bi bi-pencil-square me-1" aria-hidden="true" /> Edit quiz
            </Link>
            <button className="btn btn-outline-danger ms-auto" onClick={remove}>Delete</button>
          </div>
        </div>
        {quiz.questions.map((q, i) => (
          <div key={q._id} className="card card-body mb-2">
            <strong>{i + 1}. {q.text} <span className="small fw-normal" style={{ color: 'var(--lms-text-muted)' }}>({q.marks} marks, {q.type === 'mcq' ? 'multiple choice' : 'written'})</span></strong>
            {q.type === 'mcq' && (
              <ul className="mb-0 mt-2">
                {q.options.map((o) => (
                  <li key={o._id} className={o.isCorrect ? 'text-success fw-semibold' : ''}>
                    {o.text}{o.isCorrect && ' ✓'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </>
    );
  }

  /* Student: active attempt */
  if (session && !finished) {
    return (
      <>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <Taker quizId={id} session={session} onError={setError} onFinished={(a) => { setSession(null); setFinished(a); load(); }} />
      </>
    );
  }

  /* Student: start / result screen */
  const open = data.attempts.find((a) => a.status === 'in_progress');
  const used = data.attempts.filter((a) => a.status !== 'in_progress').length + (open ? 1 : 0);
  const exhausted = !open && used >= quiz.maxAttempts;

  return (
    <>
      <nav aria-label="breadcrumb"><ol className="breadcrumb"><li className="breadcrumb-item"><Link to="/quizzes">Quizzes</Link></li><li className="breadcrumb-item active">{quiz.title}</li></ol></nav>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {finished && (
        <div className="alert alert-success" role="status">
          <strong>Submitted.</strong> You scored {finished.score} of {finished.maxScore} ({finished.percent}%).
          {finished.pendingReview && ' Written answers are waiting for your instructor to grade, so this score may go up.'}
        </div>
      )}

      <div className="card card-body mb-4">
        <h1 className="h4 mb-1">
          {quiz.title}
          {quiz.isExam && <span className="badge text-bg-dark ms-2">Exam</span>}
        </h1>
        <ul className="mb-3 mt-1" style={{ color: 'var(--lms-text-muted)', fontSize: 14 }}>
          <li>{quiz.questionCount} questions, {quiz.totalMarks} marks</li>
          <li>{quiz.timeLimitMin ? `Time limit: ${quiz.timeLimitMin} minutes, starting when you begin` : 'No time limit'}</li>
          <li>Attempts used: {used} of {quiz.maxAttempts}</li>
        </ul>
        <div>
          <button className="btn btn-primary" disabled={busy || exhausted} onClick={start}>
            {busy && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />}
            {open ? 'Resume attempt' : exhausted ? 'No attempts left' : used > 0 ? 'Start another attempt' : 'Start quiz'}
          </button>
        </div>
      </div>

      {data.attempts.filter((a) => a.status !== 'in_progress').length > 0 && (
        <div className="card">
          <div className="card-header">Your attempts</div>
          <ul className="list-group list-group-flush">
            {data.attempts.filter((a) => a.status !== 'in_progress').map((a) => (
              <li key={a.id} className="list-group-item d-flex justify-content-between">
                <span>Attempt {a.attemptNumber} <span className="small" style={{ color: 'var(--lms-text-muted)' }}>{fmtDateTime(a.submittedAt)}</span></span>
                <span className="font-tabular">
                  {a.score} / {a.maxScore} ({a.percent}%)
                  {a.pendingReview && <span className="badge text-bg-warning ms-2">Pending review</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
