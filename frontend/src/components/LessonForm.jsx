import { useState } from 'react';
import api, { errorMessage } from '../services/api.js';

const TYPES = [['text', 'Text'], ['video', 'Video'], ['pdf', 'PDF'], ['document', 'Document'], ['image', 'Image']];

export default function LessonForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: initial?.title || '', type: initial?.type || 'text', content: initial?.content || '',
    resourceUrl: initial?.resourceUrl || '', durationMin: initial?.durationSec ? Math.round(initial.durationSec / 60) : '',
  });
  const [fileName, setFileName] = useState(initial?.resourceUrl?.startsWith('/api/files/') ? 'Current file kept' : '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Read the real length from the video file itself so completion rules never depend on a typed-in guess.
  const measure = (file) => new Promise((resolve) => {
    if (!file.type.startsWith('video/')) return resolve(null);
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (val) => { URL.revokeObjectURL(url); resolve(val); };
    v.preload = 'metadata';
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null);
    v.onerror = () => done(null);
    v.src = url;
  });

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setError('');
    const seconds = await measure(file);
    const body = new FormData();
    body.append('file', file);
    try {
      const { data } = await api.post('/uploads/resource', body);
      setForm((f) => ({ ...f, resourceUrl: data.url, type: data.type, ...(seconds ? { durationMin: String(Math.round((seconds / 60) * 100) / 100) } : {}) }));
      setFileName(data.originalName);
    } catch (err) { setError(errorMessage(err)); } finally { setUploading(false); e.target.value = ''; }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    const payload = { title: form.title, type: form.type };
    if (form.type === 'text') payload.content = form.content;
    else payload.resourceUrl = form.resourceUrl;
    if (form.durationMin !== '') payload.durationSec = Math.round(Number(form.durationMin) * 60);
    try { await onSave(payload); } catch (err) { setError(errorMessage(err)); setSaving(false); }
  };

  return (
    <form className="border rounded p-3" style={{ background: 'var(--lms-surface-raised)' }} onSubmit={submit}>
      {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
      <div className="row g-2">
        <div className="col-md-6">
          <label className="form-label small" htmlFor="l-title">Lesson title</label>
          <input id="l-title" className="form-control" required value={form.title} onChange={set('title')} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small" htmlFor="l-type">Type</label>
          <select id="l-type" className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, resourceUrl: '' })}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small" htmlFor="l-dur">Length (minutes)</label>
          <input id="l-dur" type="number" min="0" step="any" className="form-control" aria-describedby="l-dur-help" value={form.durationMin} onChange={set('durationMin')} />
          {form.type === 'video' && <div id="l-dur-help" className="form-text">Filled in automatically when you upload a video file. For a linked video, enter its exact length.</div>}
        </div>
        {form.type === 'text' ? (
          <div className="col-12">
            <label className="form-label small" htmlFor="l-content">Lesson text</label>
            <textarea id="l-content" rows="5" className="form-control" required value={form.content} onChange={set('content')} />
          </div>
        ) : (
          <>
            <div className="col-md-6">
              <label className="form-label small" htmlFor="l-file">Upload a file</label>
              <input id="l-file" type="file" className="form-control" onChange={upload} disabled={uploading}
                accept=".mp4,.webm,.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx" />
              <div className="form-text">{uploading ? 'Uploading…' : fileName || 'MP4, WebM, PDF, Office documents and images.'}</div>
            </div>
            <div className="col-md-6">
              <label className="form-label small" htmlFor="l-url">Or paste a link</label>
              <input id="l-url" type="url" className="form-control" placeholder="https://…"
                value={form.resourceUrl.startsWith('/api/') ? '' : form.resourceUrl}
                onChange={(e) => { setForm({ ...form, resourceUrl: e.target.value }); setFileName(''); }} />
            </div>
          </>
        )}
      </div>
      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-primary btn-sm" disabled={saving || uploading}>{saving ? 'Saving…' : 'Save lesson'}</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
