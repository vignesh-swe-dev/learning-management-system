import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Pagination from '../components/Pagination.jsx';
import { downloadBlob, fmtDateTime } from '../utils/format.js';

function GradeRow({ sub, maxMarks, onSaved, onError }) {
  const [marks, setMarks] = useState(sub.marks ?? '');
  const [feedback, setFeedback] = useState(sub.feedback || '');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.patch(`/submissions/${sub._id}/grade`, { marks: Number(marks), feedback }); onSaved(); } catch (err) { onError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <form className="row g-2 align-items-end" onSubmit={save}>
      <div className="col-auto"><label className="form-label small mb-0" htmlFor={`m-${sub._id}`}>Marks (of {maxMarks})</label>
        <input id={`m-${sub._id}`} type="number" min="0" max={maxMarks} step="0.5" required className="form-control form-control-sm" style={{ width: 110 }} value={marks} onChange={(e) => setMarks(e.target.value)} /></div>
      <div className="col"><label className="form-label small mb-0" htmlFor={`f-${sub._id}`}>Feedback</label>
        <input id={`f-${sub._id}`} className="form-control form-control-sm" value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
      <div className="col-auto"><button className="btn btn-primary btn-sm" disabled={busy}>{sub.status === 'graded' ? 'Update grade' : 'Save grade'}</button></div>
    </form>
  );
}

export default function AssignmentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const staff = user.role !== 'student';
  const [data, setData] = useState(null);
  const [subs, setSubs] = useState({ data: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/assignments/${id}`);
      setData(d);
      setText((t) => t || d.submission?.answerText || '');
      if (staff) setSubs((await api.get(`/assignments/${id}/submissions`, { params: { page, limit: 10 } })).data);
    } catch (e) { setError(errorMessage(e)); }
  }, [id, staff, page]);
  useEffect(() => { load(); }, [load]);

  const download = (subId) => downloadBlob(api, `/submissions/${subId}/file`, 'submission').catch((e) => setError(errorMessage(e)));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    const body = new FormData();
    body.append('answerText', text);
    if (file) body.append('file', file);
    try { await api.post(`/assignments/${id}/submit`, body); setFile(null); e.target.reset(); setNotice('Your work has been submitted.'); await load(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this assignment and all submissions?')) return;
    try { await api.delete(`/assignments/${id}`); navigate('/assignments'); } catch (err) { setError(errorMessage(err)); }
  };

  if (error && !data) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!data) return <div className="skeleton" style={{ height: 240 }} />;
  const { assignment, submission } = data;
  const late = new Date() > new Date(assignment.dueAt);
  const canSubmit = !staff && (!submission || submission.status !== 'graded') && (!late || (assignment.allowLate && !submission));

  return (
    <>
      <nav aria-label="breadcrumb"><ol className="breadcrumb"><li className="breadcrumb-item"><Link to="/assignments">Assignments</Link></li><li className="breadcrumb-item active">{assignment.title}</li></ol></nav>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <div className="card card-body mb-4">
        <div className="d-flex align-items-start gap-2">
          <h1 className="h4 me-auto">{assignment.title}</h1>
          {staff && <button className="btn btn-outline-danger btn-sm" onClick={remove}>Delete</button>}
        </div>
        <p className="text-muted small mb-2">Course: {assignment.course?.title} · Due {fmtDateTime(assignment.dueAt)} · {assignment.maxMarks} marks
          {assignment.allowLate ? ` · Late work accepted (${assignment.latePenaltyPercent}% penalty)` : ' · No late work'}</p>
        <p style={{ whiteSpace: 'pre-wrap' }} className="mb-0">{assignment.description}</p>
      </div>

      {!staff && submission && (
        <div className="card card-body mb-4">
          <h2 className="h6">Your submission</h2>
          <p className="small text-muted mb-2">Submitted {fmtDateTime(submission.submittedAt)}{submission.isLate && <span className="badge text-bg-warning ms-2">Late</span>}</p>
          {submission.answerText && <p style={{ whiteSpace: 'pre-wrap' }}>{submission.answerText}</p>}
          {submission.files?.[0] && <div className="mb-2"><button className="btn btn-outline-secondary btn-sm" onClick={() => download(submission._id)}><i className="bi bi-download" aria-hidden="true" /> {submission.files[0].originalName}</button></div>}
          {submission.status === 'graded'
            ? <div className="alert alert-success mb-0"><strong>{submission.finalMarks} / {assignment.maxMarks}</strong>{submission.isLate && submission.marks !== submission.finalMarks && <span className="small"> (graded {submission.marks}, reduced for late submission)</span>}
              {submission.feedback && <div className="mt-1">{submission.feedback}</div>}</div>
            : <span className="badge text-bg-info align-self-start">Awaiting grade</span>}
        </div>
      )}

      {canSubmit && (
        <form className="card card-body mb-4" onSubmit={submit}>
          <h2 className="h6">{submission ? 'Update your submission' : 'Submit your work'}</h2>
          {late && <div className="alert alert-warning py-2">The deadline has passed. This will be marked late{assignment.latePenaltyPercent ? ` and reduced by ${assignment.latePenaltyPercent}%` : ''}.</div>}
          <label className="form-label" htmlFor="s-text">Your answer</label>
          <textarea id="s-text" rows="5" className="form-control mb-3" value={text} onChange={(e) => setText(e.target.value)} />
          <label className="form-label" htmlFor="s-file">Attach a file (optional)</label>
          <input id="s-file" type="file" className="form-control" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip" onChange={(e) => setFile(e.target.files[0] || null)} />
          <div className="form-text mb-3">PDF, Word, image or ZIP, up to 10 MB.{submission && ' A new file replaces the earlier one.'}</div>
          <div><button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : submission ? 'Resubmit' : 'Submit'}</button></div>
        </form>
      )}
      {!staff && !canSubmit && !submission && <div className="alert alert-secondary">The deadline has passed and this assignment no longer accepts submissions.</div>}

      {staff && (
        <>
          <h2 className="h5 mb-3">Submissions</h2>
          {subs.data.length === 0 && <div className="card card-body text-muted">No submissions yet.</div>}
          {subs.data.map((s) => (
            <div key={s._id} className="card mb-3">
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                  <strong className="me-auto">{s.student?.name} <span className="small text-muted fw-normal">{s.student?.email}</span></strong>
                  {s.isLate && <span className="badge text-bg-warning">Late</span>}
                  <span className={`badge ${s.status === 'graded' ? 'text-bg-success' : 'text-bg-info'}`}>{s.status === 'graded' ? `Graded ${s.finalMarks}/${assignment.maxMarks}` : 'Needs grading'}</span>
                  <span className="small text-muted">{fmtDateTime(s.submittedAt)}</span>
                </div>
                {s.answerText && <p style={{ whiteSpace: 'pre-wrap' }} className="small">{s.answerText}</p>}
                {s.files?.[0] && <p><button className="btn btn-outline-secondary btn-sm" onClick={() => download(s._id)}><i className="bi bi-download" aria-hidden="true" /> {s.files[0].originalName}</button></p>}
                <GradeRow sub={s} maxMarks={assignment.maxMarks} onSaved={load} onError={setError} />
              </div>
            </div>
          ))}
          <Pagination page={page} pages={subs.pages} total={subs.total} label="submissions" onChange={setPage} />
        </>
      )}
    </>
  );
}
