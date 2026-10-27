import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Pagination from '../components/Pagination.jsx';

export default function Quizzes() {
  const { user } = useAuth();
  const staff = user.role !== 'student';
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.get('/quizzes', { params: { page, limit: 10 } }).then((r) => live && setResult(r.data)).catch((e) => live && setError(errorMessage(e))).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [page]);

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0 me-auto">Quizzes and exams</h1>
        {staff && <Link to="/quizzes/new" className="btn btn-primary"><i className="bi bi-plus-lg" aria-hidden="true" /> New quiz</Link>}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead><tr><th>Title</th><th>Course</th><th>Questions</th><th>Time</th><th>{staff ? 'Attempts' : 'Your attempts'}</th></tr></thead>
            <tbody>
              {loading && [...Array(4)].map((_, i) => <tr key={i}><td colSpan="5"><div className="skeleton" style={{ height: 18 }} /></td></tr>)}
              {!loading && result.data.length === 0 && <tr><td colSpan="5" className="text-center text-muted py-5">{staff ? 'No quizzes yet. Create one to get started.' : 'No quizzes in your courses yet.'}</td></tr>}
              {!loading && result.data.map((q) => (
                <tr key={q._id}>
                  <td><Link to={`/quizzes/${q._id}`}>{q.title}</Link>{q.isExam && <span className="badge text-bg-dark ms-2">Exam</span>}</td>
                  <td>{q.course?.title}</td>
                  <td>{q.questionCount} · {q.totalMarks} marks</td>
                  <td>{q.timeLimitMin ? `${q.timeLimitMin} min` : 'Untimed'}</td>
                  <td>{staff
                    ? <>{q.attemptCount}{q.pendingReviewCount > 0 && <span className="badge text-bg-warning ms-2">{q.pendingReviewCount} to grade</span>}</>
                    : <>{q.attemptsUsed} of {q.maxAttempts}{q.attemptsUsed > 0 && <span className="text-muted"> · best {q.bestPercent}%</span>}</>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pages={result.pages} total={result.total} label="quizzes" onChange={setPage} />
    </>
  );
}
