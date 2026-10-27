import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const newMcq = () => ({ text: '', type: 'mcq', marks: 1, options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] });
const newEssay = () => ({ text: '', type: 'descriptive', marks: 5, options: [] });
const clean = (qs) => qs.map((q) => ({ text: q.text, type: q.type, marks: Number(q.marks),
  ...(q.type === 'mcq' ? { options: q.options.map((o) => ({ text: o.text, isCorrect: Boolean(o.isCorrect) })) } : {}) }));

export default function QuizEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ courseId: params.get('courseId') || '', title: '', timeLimitMin: '', maxAttempts: 1, isExam: false });
  const [questions, setQuestions] = useState([newMcq()]);
  const [original, setOriginal] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (isNew) api.get('/courses', { params: { limit: 100, ...(user.role === 'instructor' ? { mine: true } : {}) } }).then((r) => setCourses(r.data.data));
  }, [isNew, user.role]);

  useEffect(() => {
    if (isNew) return;
    api.get(`/quizzes/${id}`).then(({ data }) => {
      const q = data.quiz;
      setForm({ title: q.title, timeLimitMin: q.timeLimitMin || '', maxAttempts: q.maxAttempts, isExam: q.isExam });
      setQuestions(q.questions);
      setOriginal(JSON.stringify(clean(q.questions)));
    }).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  }, [id, isNew]);

  const setQ = (i, patch) => setQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setOpt = (i, k, patch) => setQ(i, { options: questions[i].options.map((o, j) => (j === k ? { ...o, ...patch } : o)) });
  const markCorrect = (i, k) => setQ(i, { options: questions[i].options.map((o, j) => ({ ...o, isCorrect: j === k })) });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    const body = { title: form.title, maxAttempts: Number(form.maxAttempts), isExam: form.isExam, timeLimitMin: form.timeLimitMin === '' ? null : Number(form.timeLimitMin) };
    const cleaned = clean(questions);
    try {
      if (isNew) {
        const { data } = await api.post('/quizzes', { ...body, courseId: form.courseId, questions: cleaned });
        navigate(`/quizzes/${data.quiz._id}`);
      } else {
        if (JSON.stringify(cleaned) !== original) body.questions = cleaned; // unchanged questions are not resent, so settings can still be edited after attempts exist
        await api.patch(`/quizzes/${id}`, body);
        navigate(`/quizzes/${id}`);
      }
    } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  };

  if (loading) return <div className="skeleton" style={{ height: 240 }} />;

  return (
    <form onSubmit={save}>
      <nav aria-label="breadcrumb"><ol className="breadcrumb"><li className="breadcrumb-item"><Link to="/quizzes">Quizzes</Link></li><li className="breadcrumb-item active">{isNew ? 'New quiz' : 'Edit quiz'}</li></ol></nav>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="card card-body mb-4">
        <div className="row g-3">
          {isNew && (
            <div className="col-md-6">
              <label className="form-label" htmlFor="q-course">Course</label>
              <select id="q-course" className="form-select" required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                <option value="">Choose a course</option>{courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
          )}
          <div className="col-md-6"><label className="form-label" htmlFor="q-title">Title</label><input id="q-title" className="form-control" required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="col-6 col-md-3"><label className="form-label" htmlFor="q-time">Time limit (minutes)</label><input id="q-time" type="number" min="1" className="form-control" placeholder="None" value={form.timeLimitMin} onChange={(e) => setForm({ ...form, timeLimitMin: e.target.value })} /></div>
          <div className="col-6 col-md-3"><label className="form-label" htmlFor="q-att">Attempts allowed</label><input id="q-att" type="number" min="1" max="10" className="form-control" required value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} /></div>
          <div className="col-md-3 d-flex align-items-end"><div className="form-check"><input id="q-exam" type="checkbox" className="form-check-input" checked={form.isExam} onChange={(e) => setForm({ ...form, isExam: e.target.checked })} /><label className="form-check-label" htmlFor="q-exam">This is an exam</label></div></div>
        </div>
      </div>

      {questions.map((q, i) => (
        <div key={i} className="card card-body mb-3">
          <div className="d-flex gap-2 align-items-center mb-2">
            <strong className="me-auto">Question {i + 1} <span className="badge text-bg-light border ms-1">{q.type === 'mcq' ? 'Multiple choice' : 'Written answer'}</span></strong>
            <label className="small" htmlFor={`marks-${i}`}>Marks</label>
            <input id={`marks-${i}`} type="number" min="0" step="0.5" className="form-control form-control-sm" style={{ width: 80 }} value={q.marks} onChange={(e) => setQ(i, { marks: e.target.value })} />
            {questions.length > 1 && <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>Remove</button>}
          </div>
          <textarea className="form-control mb-2" rows="2" required minLength={3} aria-label={`Question ${i + 1} text`} placeholder="Question text" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
          {q.type === 'mcq' && (
            <>
              {q.options.map((o, k) => (
                <div key={k} className="input-group mb-2">
                  <div className="input-group-text"><input className="form-check-input mt-0" type="radio" name={`correct-${i}`} checked={o.isCorrect} onChange={() => markCorrect(i, k)} aria-label={`Option ${k + 1} is correct`} /></div>
                  <input className="form-control" required aria-label={`Option ${k + 1} text`} placeholder={`Option ${k + 1}`} value={o.text} onChange={(e) => setOpt(i, k, { text: e.target.value })} />
                  {q.options.length > 2 && <button type="button" className="btn btn-outline-secondary" aria-label={`Remove option ${k + 1}`} onClick={() => setQ(i, { options: q.options.filter((_, j) => j !== k).map((x, j, arr) => (arr.some((y) => y.isCorrect) ? x : { ...x, isCorrect: j === 0 })) })}><i className="bi bi-x-lg" aria-hidden="true" /></button>}
                </div>
              ))}
              {q.options.length < 6 && <div><button type="button" className="btn btn-link btn-sm p-0" onClick={() => setQ(i, { options: [...q.options, { text: '', isCorrect: false }] })}>Add option</button></div>}
              <div className="form-text">Select the radio button next to the correct answer.</div>
            </>
          )}
          {q.type === 'descriptive' && <div className="form-text">Students type a written answer. You grade it by hand after they submit.</div>}
        </div>
      ))}
      <div className="d-flex gap-2 mb-4">
        <button type="button" className="btn btn-outline-primary" onClick={() => setQuestions([...questions, newMcq()])}>Add multiple-choice question</button>
        <button type="button" className="btn btn-outline-primary" onClick={() => setQuestions([...questions, newEssay()])}>Add written question</button>
      </div>
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create quiz' : 'Save changes'}</button>
    </form>
  );
}
