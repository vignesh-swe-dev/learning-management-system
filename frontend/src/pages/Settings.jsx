import { useState } from 'react';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { user, setUser, replaceToken } = useAuth();
  const uid = user._id || user.id;
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState({ profile: '', privacy: '', password: '' });
  const [err, setErr] = useState({ profile: '', privacy: '', password: '' });
  const say = (k, ok, bad = '') => { setMsg((m) => ({ ...m, [k]: ok })); setErr((e) => ({ ...e, [k]: bad })); };

  const saveProfile = async (e) => {
    e.preventDefault();
    try { const { data } = await api.patch(`/users/${uid}`, profile); setUser(data.user); say('profile', 'Profile saved.'); } catch (x) { say('profile', '', errorMessage(x)); }
  };
  const setShare = async (share) => {
    try { const { data } = await api.patch(`/users/${uid}`, { shareLiveActivity: share }); setUser(data.user); say('privacy', share ? 'Your instructors can see your live status again.' : 'Your live status is now hidden from your instructors.'); } catch (x) { say('privacy', '', errorMessage(x)); }
  };
  const changePassword = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/change-password', pw);
      replaceToken(data.token); setPw({ currentPassword: '', newPassword: '' });
      say('password', 'Password changed. Other devices have been signed out.');
    } catch (x) { say('password', '', errorMessage(x)); }
  };
  const Note = ({ k }) => (<>{msg[k] && <div className="alert alert-success py-2" role="status">{msg[k]}</div>}{err[k] && <div className="alert alert-danger py-2" role="alert">{err[k]}</div>}</>);
  const sharing = user.shareLiveActivity !== false;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="h4 mb-4">Profile and settings</h1>
      <form className="card card-body mb-4" onSubmit={saveProfile}>
        <h2 className="h6">Profile</h2><Note k="profile" />
        <label className="form-label" htmlFor="st-name">Name</label><input id="st-name" className="form-control mb-3" required minLength={2} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        <label className="form-label" htmlFor="st-phone">Phone (optional)</label><input id="st-phone" className="form-control mb-3" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
        <div className="small text-muted mb-3">Email: {user.email} · Role: <span className="text-capitalize">{user.role}</span></div>
        <div><button className="btn btn-primary">Save profile</button></div>
      </form>

      {user.role === 'student' && (
        <div className="card card-body mb-4">
          <h2 className="h6">Privacy: live activity</h2><Note k="privacy" />
          <p className="small text-muted">While you use the LMS, your instructors can see whether you are online and which lesson you have open. We only look at activity inside this site, never your location or what you do elsewhere.</p>
          <div className="form-check form-switch mb-2">
            <input id="st-share" className="form-check-input" type="checkbox" role="switch" checked={sharing} onChange={(e) => setShare(e.target.checked)} />
            <label className="form-check-label" htmlFor="st-share">Show my live status to my instructors</label>
          </div>
          <p className="small text-muted mb-0">If you turn this off, your progress, submissions, quiz results and attendance are still recorded, because they are part of your course record. Joining a live session is always your own choice.</p>
        </div>
      )}

      <form className="card card-body" onSubmit={changePassword}>
        <h2 className="h6">Change password</h2><Note k="password" />
        <label className="form-label" htmlFor="st-cur">Current password</label><input id="st-cur" type="password" autoComplete="current-password" className="form-control mb-3" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        <label className="form-label" htmlFor="st-new">New password</label><input id="st-new" type="password" autoComplete="new-password" className="form-control" required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} aria-describedby="st-help" />
        <div id="st-help" className="form-text mb-3">At least 8 characters, with a letter and a number.</div>
        <div><button className="btn btn-primary">Change password</button></div>
      </form>
    </div>
  );
}
