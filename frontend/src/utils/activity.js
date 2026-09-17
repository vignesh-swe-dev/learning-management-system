const TEXT = {
  'lesson.started': (m) => `started “${m?.lessonTitle || 'a lesson'}”`,
  'lesson.completed': (m) => `completed “${m?.lessonTitle || 'a lesson'}”`,
  'assignment.submit': (m) => `submitted “${m?.title || 'an assignment'}”${m?.isLate ? ' (late)' : ''}`,
  'quiz.start': (m) => `started “${m?.title || 'a quiz'}”`,
  'quiz.submit': (m) => `finished “${m?.title || 'a quiz'}”`,
  'attendance.join': () => 'joined a live session',
};
export const ICON = {
  'lesson.started': 'bi-play-circle', 'lesson.completed': 'bi-check-circle', 'assignment.submit': 'bi-upload',
  'quiz.start': 'bi-patch-question', 'quiz.submit': 'bi-patch-check', 'attendance.join': 'bi-person-check',
};
export const describe = (action, meta) => (TEXT[action] ? TEXT[action](meta) : action);

// Turns a live socket event into the same shape the activity feed API returns.
export function fromEvent(event, p) {
  const map = {
    'lesson:started': ['lesson.started', { lessonTitle: p.lessonTitle }],
    'lesson:completed': ['lesson.completed', { lessonTitle: p.lessonTitle }],
    'assignment:submitted': ['assignment.submit', { title: p.title, isLate: p.isLate }],
    'quiz:submitted': ['quiz.submit', { title: p.title }],
    'attendance:joined': ['attendance.join', {}],
  };
  const [action, meta] = map[event] || [];
  return action ? { id: `${event}-${p.at}-${p.studentId}`, action, meta, user: { id: p.studentId, name: p.studentName }, course: p.courseTitle ? { title: p.courseTitle } : null, createdAt: p.at } : null;
}
export const LIVE_FEED_EVENTS = ['lesson:started', 'lesson:completed', 'assignment:submitted', 'quiz:submitted', 'attendance:joined'];

export const tzOffset = () => -new Date().getTimezoneOffset();
export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export function bucketLabel(start, period) {
  const d = new Date(start);
  if (period === 'monthly') return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
  if (period === 'weekly') return `Wk ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
