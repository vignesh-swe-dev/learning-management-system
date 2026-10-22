const env = require('../config/env');

// Who is connected right now. Held in memory on purpose: presence is short-lived, so it is never written to
// the database. With more than one server instance this needs a shared store (see the Socket.IO adapter note in the docs).
const users = new Map();

function connect(user, socketId, courseIds = []) {
  let entry = users.get(user.id);
  const first = !entry || entry.sockets.size === 0;
  if (!entry) {
    entry = { id: user.id, name: user.name, role: user.role, sockets: new Set(), onlineSince: new Date(), offlineTimer: null };
    users.set(user.id, entry);
  }
  if (entry.offlineTimer) { clearTimeout(entry.offlineTimer); entry.offlineTimer = null; } // reconnected within the grace period
  if (first && !entry.reconnected) entry.onlineSince = new Date();
  entry.sockets.add(socketId);
  entry.share = user.shareLiveActivity !== false;
  entry.courseIds = courseIds.map(String);
  entry.lastActivityAt = new Date();
  const announce = first && !entry.pendingOffline; // a quick reconnect should not announce "online" twice
  entry.pendingOffline = false;
  return { entry, announce };
}

// Calls onOffline once the user has had no connection for the grace period.
function disconnect(userId, socketId, onOffline) {
  const entry = users.get(userId);
  if (!entry) return;
  entry.sockets.delete(socketId);
  if (entry.sockets.size > 0) return;
  entry.pendingOffline = true;
  entry.reconnected = true;
  entry.disconnectedAt = new Date();
  entry.offlineTimer = setTimeout(() => {
    if (entry.sockets.size === 0) {
      users.delete(userId);
      onOffline(entry);
    }
  }, env.presenceGraceMs);
  entry.offlineTimer.unref?.();
}

const get = (userId) => users.get(userId);
const isOnline = (userId) => Boolean(users.get(userId)?.sockets.size);
const online = () => [...users.values()].filter((e) => e.sockets.size > 0);

function setLocation(userId, loc) {
  const e = users.get(userId);
  if (e) { Object.assign(e, loc); e.lastActivityAt = new Date(); }
  return e;
}
const touch = (userId) => { const e = users.get(userId); if (e) e.lastActivityAt = new Date(); };
const setShare = (userId, share) => { const e = users.get(userId); if (e) e.share = share; return e; };
const setCourseIds = (userId, ids) => { const e = users.get(userId); if (e) e.courseIds = ids.map(String); };
const reset = () => { users.forEach((e) => e.offlineTimer && clearTimeout(e.offlineTimer)); users.clear(); };

module.exports = { connect, disconnect, get, isOnline, online, setLocation, touch, setShare, setCourseIds, reset };
