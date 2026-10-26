import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { assetUrl, errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import LessonForm from '../components/LessonForm.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { fmtDate, fmtDateTime } from '../utils/format.js';

const EMPTY = { title: '', description: '', category: '', level: 'beginner', durationHours: '', thumbnail: '', instructors: [] };

export default function CourseEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState('draft');
  const [modules, setModules] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [instructorOptions, setInstructorOptions] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [newModule, setNewModule] = useState('');
  const [lessonForm, setLessonForm] = useState(null); // { moduleId, lesson? }
  const [renaming, setRenaming] = useState(null); // { id, title }

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 3000); };
  const fail = (e) => setError(errorMessage(e));

  const load = useCallback(async () => {
    try {
      const [{ data }, enr] = await Promise.all([api.get(`/courses/${id}`), api.get(`/instructor/courses/${id}/progress`, { params: { limit: 50 } })]);
      const c = data.course;
      setForm({
        title: c.title, description: c.description, category: c.category, level: c.level, durationHours: c.durationHours ?? '',
        thumbnail: c.thumbnail || '', instructors: c.instructors.map((i) => i._id),
      });
      setStatus(c.status);
      setModules(data.modules);
      setEnrollments(enr.data.data);
    } catch (e) { fail(e); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (!isNew) load(); }, [isNew, load]);
  useEffect(() => {
    if (user.role === 'admin') api.get('/users', { params: { role: 'instructor', limit: 100 } }).then((r) => setInstructorOptions(r.data.data)).catch(() => {});
  }, [user.role]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const uploadThumb = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const body = new FormData(); body.append('file', file);
    setError('');
    try { setForm({ ...form, thumbnail: (await api.post('/uploads/thumbnail', body)).data.url }); } catch (err) { fail(err); }
    e.target.value = '';
  };

  const payload = () => {
    const p = { title: form.title, description: form.description, category: form.category, level: form.level, thumbnail: form.thumbnail };
    if (form.durationHours !== '') p.durationHours = Number(form.durationHours);
    if (user.role === 'admin') p.instructors = form.instructors;
    return p;
  };

  const saveCourse = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (isNew) {
        const { data } = await api.post('/courses', payload());
        navigate(`/courses/${data.course._id}/edit`, { replace: true });
      } else {
        await api.patch(`/courses/${id}`, payload());
        flash('Course saved');
      }
    } catch (err) { fail(err); } finally { setSaving(false); }
  };

  const setCourseStatus = async (next) => {
    setError('');
    try { await api.patch(`/courses/${id}`, { status: next }); setStatus(next); flash(next === 'published' ? 'Course published' : 'Course moved to draft'); } catch (err) { fail(err); }
  };

  const deleteCourse = async () => {
    if (!window.confirm('Delete this course and all of its lessons and enrollments? This cannot be undone.')) return;
    try { await api.delete(`/courses/${id}`); navigate('/courses'); } catch (err) { fail(err); }
  };

  const guard = (fn) => async (...a) => { setError(''); try { await fn(...a); await load(); } catch (err) { fail(err); } };
  const addModule = guard(async (e) => { e.preventDefault(); await api.post(`/courses/${id}/modules`, { title: newModule }); setNewModule(''); });
  const renameModule = guard(async (e) => { e.preventDefault(); await api.patch(`/modules/${renaming.id}`, { title: renaming.title }); setRenaming(null); });
  const removeModule = guard(async (m) => { if (window.confirm(`Delete "${m.title}" and its lessons?`)) await api.delete(`/modules/${m._id}`); });
  const removeLesson = guard(async (l) => { if (window.confirm(`Delete "${l.title}"?`)) await api.delete(`/lessons/${l._id}`); });
  const saveLesson = async (data) => {
    if (lessonForm.lesson) await api.patch(`/lessons/${lessonForm.lesson._id}`, data);
    else await api.post(`/modules/${lessonForm.moduleId}/lessons`, data);
    setLessonForm(null);
    await load();
  };

  if (loading) return <div className="skeleton" style={{ height: 240 }} />;

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <h1 className="h4 mb-0 me-auto">{isNew ? 'New course' : 'Edit course'}</h1>
        {!isNew && <Link to={`/courses/${id}`} className="btn btn-outline-secondary btn-sm">View course</Link>}
        {!isNew && (status === 'draft'
          ? <button className="btn btn-success btn-sm" onClick={() => setCourseStatus('published')}>Publish</button>
          : <button className="btn btn-outline-secondary btn-sm" onClick={() => setCourseStatus('draft')}>Move to draft</button>)}
        {!isNew && user.role === 'admin' && <button className="btn btn-outline-danger btn-sm" onClick={deleteCourse}>Delete</button>}
      </div>
      {!isNew && <p className="small text-muted">Status: <strong className="text-capitalize">{status}</strong></p>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <form className="card card-body mb-4" onSubmit={saveCourse}>
        <div className="row g-3">
          <div className="col-md-8">
            <label className="form-label" htmlFor="c-title">Title</label>
            <input id="c-title" className="form-control" required minLength={3} value={form.title} onChange={set('title')} />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="c-cat">Category</label>
            <input id="c-cat" className="form-control" required value={form.category} onChange={set('category')} />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="c-desc">Description</label>
            <textarea id="c-desc" rows="4" className="form-control" required minLength={10} value={form.description} onChange={set('description')} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="c-level">Level</label>
            <select id="c-level" className="form-select" value={form.level} onChange={set('level')}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="c-hours">Duration (hours)</label>
            <input id="c-hours" type="number" min="0" step="0.5" className="form-control" value={form.durationHours} onChange={set('durationHours')} />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="c-thumb">Thumbnail</label>
            <input id="c-thumb" type="file" accept=".png,.jpg,.jpeg,.webp" className="form-control" onChange={uploadThumb} />
            <div className="form-text">PNG, JPG or WebP, up to 2 MB.</div>
            {form.thumbnail && (
              <div className="d-flex align-items-center gap-2 mt-2">
                <img src={assetUrl(form.thumbnail)} alt="Thumbnail preview" style={{ height: 56, borderRadius: 6 }} />
                <button type="button" className="btn btn-link btn-sm" onClick={() => setForm({ ...form, thumbnail: '' })}>Remove</button>
              </div>
            )}
          </div>
          {user.role === 'admin' && (
            <div className="col-12">
              <label className="form-label" htmlFor="c-inst">Instructors</label>
              <select id="c-inst" multiple className="form-select" style={{ minHeight: 96 }} value={form.instructors}
                onChange={(e) => setForm({ ...form, instructors: [...e.target.selectedOptions].map((o) => o.value) })}>
                {instructorOptions.map((i) => <option key={i._id} value={i._id}>{i.name} ({i.email})</option>)}
              </select>
              <div className="form-text">Hold Ctrl or Cmd to choose more than one. A course needs an instructor before it can be published.</div>
            </div>
          )}
        </div>
        <div className="mt-3"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create course' : 'Save changes'}</button></div>
      </form>

      {!isNew && (
        <>
          <h2 className="h5 mb-3">Modules and lessons</h2>
          {modules.map((m) => (
            <div key={m._id} className="card mb-3">
              <div className="card-header d-flex align-items-center gap-2">
                {renaming?.id === m._id ? (
                  <form className="d-flex gap-2 me-auto" onSubmit={renameModule}>
                    <input className="form-control form-control-sm" aria-label="Module title" required value={renaming.title} onChange={(e) => setRenaming({ ...renaming, title: e.target.value })} />
                    <button className="btn btn-primary btn-sm">Save</button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRenaming(null)}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <strong className="me-auto">{m.title}</strong>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setRenaming({ id: m._id, title: m.title })}>Rename</button>
                    <button className="btn btn-outline-danger btn-sm" onClick={() => removeModule(m)}>Delete</button>
                  </>
                )}
              </div>
              <ul className="list-group list-group-flush">
                {m.lessons.map((l) => (
                  <li key={l._id} className="list-group-item">
                    {lessonForm?.lesson?._id === l._id
                      ? <LessonForm initial={l} onSave={saveLesson} onCancel={() => setLessonForm(null)} />
                      : (
                        <div className="d-flex align-items-center gap-2">
                          <span className="me-auto">{l.title} <span className="badge text-bg-light border text-capitalize ms-1">{l.type}</span></span>
                          <button className="btn btn-outline-secondary btn-sm" onClick={() => setLessonForm({ moduleId: m._id, lesson: l })}>Edit</button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => removeLesson(l)}>Delete</button>
                        </div>
                      )}
                  </li>
                ))}
                <li className="list-group-item">
                  {lessonForm && !lessonForm.lesson && lessonForm.moduleId === m._id
                    ? <LessonForm onSave={saveLesson} onCancel={() => setLessonForm(null)} />
                    : <button className="btn btn-outline-primary btn-sm" onClick={() => setLessonForm({ moduleId: m._id })}><i className="bi bi-plus-lg" aria-hidden="true" /> Add lesson</button>}
                </li>
              </ul>
            </div>
          ))}
          <form className="d-flex gap-2 mb-4" onSubmit={addModule}>
            <input className="form-control" placeholder="New module title" aria-label="New module title" required value={newModule} onChange={(e) => setNewModule(e.target.value)} />
            <button className="btn btn-primary text-nowrap">Add module</button>
          </form>

          <h2 className="h5 mb-3">Student progress</h2>
          <div className="card mb-4">
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead><tr><th>Name</th><th>Email</th><th style={{ minWidth: 160 }}>Progress</th><th>Last active</th><th>Enrolled</th></tr></thead>
                <tbody>
                  {enrollments.length === 0 && <tr><td colSpan="5" className="text-center text-muted py-4">No students have enrolled yet.</td></tr>}
                  {enrollments.map((e) => (
                    <tr key={e.student._id}>
                      <td>{e.student.name}</td><td>{e.student.email}</td>
                      <td><ProgressBar percent={e.percent} label={`${e.student.name} progress`} /><div className="small text-muted">{e.completed} of {e.total} lessons</div></td>
                      <td>{e.lastActivityAt ? fmtDateTime(e.lastActivityAt) : 'No activity yet'}</td><td>{fmtDate(e.enrolledAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
