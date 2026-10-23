import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import api, { tokenStore } from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const RealtimeContext = createContext(null);

// One authenticated Socket.IO connection for the whole app, opened while someone is signed in.
export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [info, setInfo] = useState(null);
  const [readyCount, setReadyCount] = useState(0); // goes up on every (re)connect, so pages can reload what they missed
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!userId) { setSocket(null); setConnected(false); setInfo(null); setUnread(0); return undefined; }
    // The token is read again on every reconnect, so a new password's token is picked up.
    const s = io(import.meta.env.VITE_API_URL || window.location.origin, { auth: (cb) => cb({ token: tokenStore.get() }) });
    let timer;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect' && tokenStore.get()) timer = setTimeout(() => s.connect(), 400); // e.g. after a password change
    });
    s.on('ready', (i) => {
      setInfo(i);
      setReadyCount((n) => n + 1);
      api.get('/notifications', { params: { limit: 1 } }).then((r) => setUnread(r.data.unreadCount)).catch(() => {});
    });
    s.on('notification:new', (n) => {
      setUnread((c) => c + 1);
      setToast(n);
    });
    setSocket(s);
    return () => { clearTimeout(timer); s.close(); };
  }, [userId]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useMemo(() => ({ socket, connected, info, readyCount, unread, setUnread, toast, dismissToast: () => setToast(null) }), [socket, connected, info, readyCount, unread, toast]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
