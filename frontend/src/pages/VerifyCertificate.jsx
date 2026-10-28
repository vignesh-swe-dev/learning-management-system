import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api.js';
import { fmtDate } from '../utils/format.js';

export default function VerifyCertificate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(id || '');
  const [state, setState] = useState(id ? 'loading' : 'idle');
  const [cert, setCert] = useState(null);

  useEffect(() => {
    if (!id) return;
    setState('loading');
    api.get(`/certificates/verify/${encodeURIComponent(id)}`)
      .then((r) => { setCert(r.data); setState('valid'); })
      .catch((e) => setState(e.response?.status === 404 ? 'invalid' : 'error'));
  }, [id]);

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <h1 className="h4 text-center mb-4">Verify a certificate</h1>
        <form className="card card-body p-4 mb-3" onSubmit={(e) => { e.preventDefault(); if (code.trim()) navigate(`/verify/${code.trim()}`); }}>
          <label className="form-label" htmlFor="v-code">Certificate ID</label>
          <input id="v-code" className="form-control mb-3" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-primary">Check</button>
        </form>
        {state === 'loading' && <div className="skeleton" style={{ height: 80 }} />}
        {state === 'valid' && <div className="alert alert-success" role="status"><strong>Valid certificate</strong><br />{cert.student} completed <strong>{cert.course}</strong> on {fmtDate(cert.issuedAt)}.<br /><span className="small">ID {cert.verificationId}</span></div>}
        {state === 'invalid' && <div className="alert alert-danger" role="alert">No certificate matches this ID. Check the code and try again.</div>}
        {state === 'error' && <div className="alert alert-warning" role="alert">We could not check this certificate right now. Try again in a moment.</div>}
        <p className="text-center small mb-0"><Link to="/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}
