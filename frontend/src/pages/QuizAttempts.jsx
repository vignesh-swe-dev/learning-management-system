import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import Pagination from '../components/Pagination.jsx';
import { fmtDateTime } from '../utils/format.js';

function Review({ attemptId, onSaved, onError }) {
  const [attempt, setAttempt] = useState(null);
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/quiz-attempts/${attemptId}`).then(({ data }) => {
      setAttempt(data.attempt);
      setMarks(Object.fromEntries(data.attempt.answers.filter((a) => a.type === 'descriptive').map((a) => [a.question, a.marksAwarded ?? ''])));
    }).catch((e) => onError(errorMessage(e)));
  }, [attemptId, onError]);

  if (!attempt) return <div className="skeleton" style={{ height: 60 }} />;
  const written = attempt.answers.filter((a) => a.type === 'descriptive');

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const grades = written.filter((a) => marks[a.question] !== '').map((a) => ({ question: a.question, marks: Number(marks[a.question]) }));
    try { await api.patch(`/quiz-attempts/${attemptId}/grade`, { grades }); onSaved(); } catch (err) { onError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} className="mt-2">
      {attempt.answers.map((a) => (
        <div key={a.question} className="border rounded p-2 mb-2">
          <div className="small fw-semibold">{a.text} <span className="text-muted fw-normal">({a.marks} marks)</span></div>
          {a.type === 'mcq'
            ? <div className={`small ${a.correct ? 'text-success' : 'text-danger'}`}>{a.selectedOption ? `Chose: ${a.selectedOption}` : 'No answer'} — {a.correct ? 'correct' : 'incorrect'}</div>
            : (
              <>
                <p className="small mb-2" style={{ whiteSpace: 'pre-wrap' }}>{a.answerText || <em className="text-muted">No answer</em>}</p>
                <div className="d-flex align-items-center gap-2">
                  <label className="small" htmlFor={`g-${a.question}`}>Marks</label>
                  <input id={`g-${a.question}`} type="number" min="0" max={a.marks} step="0.5" className="form-control form-control-sm" style={{ width: 90 }} value={marks[a.question] ?? ''} onChange={(e) => setMarks({ ...marks, [a.question]: e.target.value })} />
                  <span className="small text-muted">of {a.marks}</span>
                </div>
              </>
            )}
        </div>
      ))}
      {written.length > 0 && <button className="btn btn-primary btn-sm" disabled={busy}>Save grades</button>}
    </form>
  );
}

export default function QuizAttempts() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ data: [], total: 0, pages: 1 });
  const [quizTitle, setQuizTitle] = useState('');
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get(`/quizzes/${id}/attempts`, { params: { page, limit: 10 } }).then((r) => setData(r.data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  }, [id, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get(`/quizzes/${id}`).then((r) => setQuizTitle(r.data.quiz.title)).catch(() => {}); }, [id]);

  return (
    <>
      <nav aria-label="breadcrumb"><ol className="breadcrumb"><li className="breadcrumb-item"><Link to="/quizzes">Quizzes</Link></li><li className="breadcrumb-item"><Link to={`/quizzes/${id}`}>{quizTitle || 'Quiz'}</Link></li><li className="breadcrumb-item active">Attempts</li></ol></nav>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && <div className="skeleton" style={{ height: 120 }} />}
      {!loading && data.data.length === 0 && <div className="card card-body text-muted text-center py-5">No one has submitted an attempt yet.</div>}
      {data.data.map((a) => (
        <div key={a.id} className="card mb-2">
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <strong className="me-auto">{a.student?.name} <span className="small text-muted fw-normal">attempt {a.attemptNumber} · {fmtDateTime(a.submittedAt)}</span></strong>
              <span>{a.score} / {a.maxScore} ({a.percent}%)</span>
              <span className={`badge ${a.pendingReview ? 'text-bg-warning' : 'text-bg-success'}`}>{a.pendingReview ? 'Needs grading' : 'Graded'}</span>
              <button className="btn btn-outline-secondary btn-sm" aria-expanded={openId === a.id} onClick={() => setOpenId(openId === a.id ? null : a.id)}>{openId === a.id ? 'Hide' : 'Review'}</button>
            </div>
            {openId === a.id && <Review attemptId={a.id} onSaved={() => { load(); setOpenId(null); }} onError={setError} />}
          </div>
        </div>
      ))}
      <Pagination page={page} pages={data.pages} total={data.total} label="attempts" onChange={setPage} />
    </>
  );
}
