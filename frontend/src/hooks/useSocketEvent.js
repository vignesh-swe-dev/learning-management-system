import { useEffect, useRef } from 'react';
import { useRealtime } from '../context/RealtimeContext.jsx';

// Runs `handler` for every `event` while the component is mounted.
export function useSocketEvent(event, handler) {
  const { socket } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const h = (...args) => ref.current(...args);
    socket.on(event, h);
    return () => socket.off(event, h);
  }, [socket, event]);
}

// Calls `load` when any of the events fires (at most once per `delay`), and again after each reconnect,
// so a page that missed events while offline catches up from the REST API.
export function useLiveRefresh(events, load, delay = 1200) {
  const { socket, readyCount } = useRealtime();
  const ref = useRef(load);
  ref.current = load;
  useEffect(() => { ref.current(); }, [readyCount]);
  useEffect(() => {
    if (!socket) return undefined;
    let timer = null;
    const h = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; ref.current(); }, delay);
    };
    events.forEach((e) => socket.on(e, h));
    return () => { clearTimeout(timer); events.forEach((e) => socket.off(e, h)); };
  }, [socket, delay]); // eslint-disable-line react-hooks/exhaustive-deps
}
