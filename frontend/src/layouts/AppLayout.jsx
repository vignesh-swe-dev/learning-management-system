import { useEffect, useRef, useState } from 'react';
import { Offcanvas } from 'bootstrap';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { fmtDateTime } from '../utils/format.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

/* ── Navigation definition ──────────────────────────────── */
const NAV_GROUPS = [
  {
    label: 'Learn',
    items: [
      { to: '/dashboard',   label: 'Dashboard',     icon: 'bi-speedometer2',    roles: ['admin','instructor','student','parent'] },
      { to: '/courses',     label: 'Courses',       icon: 'bi-journal-text',    roles: ['admin','instructor','student','parent'] },
      { to: '/my-courses',  label: 'My courses',    icon: 'bi-bookmark-check',  roles: ['student'] },
      { to: '/assignments', label: 'Assignments',   icon: 'bi-pencil-square',   roles: ['admin','instructor','student'] },
      { to: '/quizzes',     label: 'Quizzes',       icon: 'bi-patch-question',  roles: ['admin','instructor','student'] },
      { to: '/results',     label: 'Results',       icon: 'bi-graph-up',        roles: ['admin','instructor','student','parent'] },
    ],
  },
  {
    label: 'Teach',
    items: [
      { to: '/live',        label: 'Live activity', icon: 'bi-activity',        roles: ['admin','instructor'] },
      { to: '/attendance',  label: 'Attendance',    icon: 'bi-person-check',    roles: ['admin','instructor','student','parent'] },
      { to: '/reports',     label: 'Reports',       icon: 'bi-bar-chart-line',  roles: ['admin','instructor','student'] },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/messages',      label: 'Messages',      icon: 'bi-chat-dots',    roles: ['admin','instructor','student','parent'] },
      { to: '/notifications', label: 'Notifications', icon: 'bi-bell',         roles: ['admin','instructor','student','parent'] },
      { to: '/users',         label: 'Users',          icon: 'bi-people',       roles: ['admin'] },
      { to: '/settings',      label: 'Settings',       icon: 'bi-gear',         roles: ['admin','instructor','student','parent'] },
    ],
  },
];

/* ── Sidebar nav ─────────────────────────────────────────── */
function SidebarNav({ role }) {
  const closeOffcanvas = () => {
    const el = document.getElementById('sidebar');
    if (el) {
      const inst = Offcanvas.getInstance(el);
      if (inst) inst.hide();
    }
  };

  return (
    <nav className="sidebar-nav flex-column" aria-label="Main navigation">
      {NAV_GROUPS.map((group, gi) => {
        const visible = group.items.filter((i) => i.roles.includes(role));
        if (!visible.length) return null;
        return (
          <div key={group.label}>
            {gi > 0 && <div className="sidebar-divider" />}
            <div className="sidebar-group-label">{group.label}</div>
            {visible.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeOffcanvas}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

/* ── Notification bell ───────────────────────────────────── */
function Bell() {
  const { unread, setUnread } = useRealtime();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const bellRef = useRef(null);
  const prevUnread = useRef(unread);

  // Shake the bell when a new notification arrives
  useEffect(() => {
    if (unread > prevUnread.current && bellRef.current) {
      bellRef.current.classList.remove('bell-shake');
      // force reflow
      void bellRef.current.offsetWidth;
      bellRef.current.classList.add('bell-shake');
      const t = setTimeout(() => bellRef.current?.classList.remove('bell-shake'), 700);
      return () => clearTimeout(t);
    }
    prevUnread.current = unread;
  }, [unread]);

  const loadLatest = () =>
    api
      .get('/notifications', { params: { limit: 5 } })
      .then((r) => { setItems(r.data.data); setUnread(r.data.unreadCount); })
      .catch(() => setItems([]));

  const open = async (n) => {
    if (!n.readAt) {
      await api.patch(`/notifications/${n._id}/read`).catch(() => {});
      setUnread((c) => Math.max(0, c - 1));
    }
    if (n.link) navigate(n.link);
    else navigate('/notifications');
  };

  return (
    <div className="dropdown bell-btn">
      <button
        ref={bellRef}
        className="btn-icon"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        aria-label={`Notifications, ${unread} unread`}
        onClick={loadLatest}
      >
        <i className="bi bi-bell" style={{ fontSize: 18 }} aria-hidden="true" />
        {unread > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger bell-badge" style={{ fontSize: 10 }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      <div className="dropdown-menu dropdown-menu-end p-0" style={{ width: 340, maxWidth: '90vw' }}>
        <div className="px-3 py-2 border-bottom fw-semibold" style={{ fontSize: 14 }}>Notifications</div>
        {items === null && <div className="p-3"><div className="skeleton" style={{ height: 40 }} /></div>}
        {items && items.length === 0 && <div className="p-3 small" style={{ color: 'var(--lms-text-muted)' }}>You are all caught up.</div>}
        {items && items.map((n) => (
          <button key={n._id} className="dropdown-item py-2 text-wrap" onClick={() => open(n)}>
            <div className={n.readAt ? '' : 'fw-semibold'} style={{ fontSize: 13 }}>{n.title}</div>
            <div className="small" style={{ color: 'var(--lms-text-muted)' }}>{fmtDateTime(n.createdAt)}</div>
          </button>
        ))}
        <Link to="/notifications" className="dropdown-item text-center border-top small py-2">
          See all notifications
        </Link>
      </div>
    </div>
  );
}

/* ── Privacy notice ──────────────────────────────────────── */
function PrivacyNotice() {
  const { info, connected } = useRealtime();
  const { user } = useAuth();
  if (!info?.liveTracking) return null;
  const shared = user.shareLiveActivity !== false;
  return (
    <div className="privacy-notice" role="status">
      <i className={`bi ${shared ? 'bi-eye' : 'bi-eye-slash'} me-1`} aria-hidden="true" />
      {shared
        ? 'Live activity is on: your instructors can see when you are online and which lesson you have open, inside this site only.'
        : 'Live status is hidden from your instructors. Your progress, submissions and attendance are still recorded.'}{' '}
      <Link to="/settings">Change</Link>
      {!connected && <span className="ms-2 text-warning-emphasis">Reconnecting…</span>}
    </div>
  );
}

/* ── Toast notification ──────────────────────────────────── */
function Toast() {
  const { toast, dismissToast } = useRealtime();
  const navigate = useNavigate();
  if (!toast) return null;
  return (
    <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1080 }}>
      <div className="toast show shadow toast-enter" role="status" aria-live="polite">
        <div className="toast-header">
          <i className="bi bi-bell me-2" aria-hidden="true" />
          <strong className="me-auto">{toast.title}</strong>
          <button className="btn-close" aria-label="Dismiss" onClick={dismissToast} />
        </div>
        {toast.body && (
          <div className="toast-body">
            {toast.body}
            {toast.link && (
              <div className="mt-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { dismissToast(); navigate(toast.link); }}
                >
                  View
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main layout ─────────────────────────────────────────── */
export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const topbarRef = useRef(null);

  const signOut = async () => { await logout(); navigate('/login'); };

  // Topbar scroll shadow
  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;
    const sentinel = document.createElement('div');
    sentinel.style.position = 'absolute';
    sentinel.style.top = '0';
    sentinel.style.left = '0';
    sentinel.style.height = '1px';
    sentinel.style.width = '1px';
    sentinel.style.pointerEvents = 'none';
    sentinel.style.opacity = '0';
    el.parentElement?.insertBefore(sentinel, el);
    const obs = new IntersectionObserver(
      ([entry]) => el.classList.toggle('scrolled', !entry.isIntersecting),
      { threshold: 1 }
    );
    obs.observe(sentinel);
    return () => { obs.disconnect(); sentinel.remove(); };
  }, []);

  return (
    <>
      {/* ─── Sidebar ─────────────────────────────────────── */}
      <aside
        className="sidebar offcanvas-lg offcanvas-start"
        id="sidebar"
        tabIndex="-1"
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <span className="brand-mark" style={{ width: 34, height: 34 }}>
            <i className="bi bi-mortarboard-fill" style={{ fontSize: 18 }} aria-hidden="true" />
          </span>
          <strong>LMS</strong>
          <button
            type="button"
            className="btn-close ms-auto d-lg-none"
            data-bs-dismiss="offcanvas"
            data-bs-target="#sidebar"
            aria-label="Close menu"
          />
        </div>
        <SidebarNav role={user.role} />
      </aside>

      {/* ─── Main column ─────────────────────────────────── */}
      <div className="layout-main d-flex flex-column min-vh-100">
        <header ref={topbarRef} className="topbar">
          {/* Mobile hamburger */}
          <button
            className="btn-icon d-lg-none"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#sidebar"
            aria-controls="sidebar"
            aria-label="Open menu"
          >
            <i className="bi bi-list" style={{ fontSize: 22 }} aria-hidden="true" />
          </button>

          <div className="ms-auto d-flex align-items-center gap-2">
            <ThemeToggle />
            <Bell />

            {/* Profile dropdown */}
            <div className="dropdown">
              <button
                className="btn btn-light d-flex align-items-center gap-2"
                style={{ fontSize: 14, borderRadius: 'var(--lms-radius-sm)' }}
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="bi bi-person-circle" style={{ fontSize: 18 }} aria-hidden="true" />
                <span className="d-none d-sm-inline">{user.name}</span>
                <i className="bi bi-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li><span className="dropdown-item-text small text-capitalize" style={{ color: 'var(--lms-text-muted)' }}>{user.role}</span></li>
                <li><hr className="dropdown-divider" /></li>
                <li><Link className="dropdown-item" to="/settings">
                  <i className="bi bi-gear me-2" aria-hidden="true" />Profile &amp; settings
                </Link></li>
                <li><button className="dropdown-item text-danger" onClick={signOut}>
                  <i className="bi bi-box-arrow-right me-2" aria-hidden="true" />Sign out
                </button></li>
              </ul>
            </div>
          </div>
        </header>

        <PrivacyNotice />

        <main className="flex-grow-1 p-3 p-md-4 route-transition">
          <Outlet />
        </main>

        <Toast />
      </div>
    </>
  );
}
