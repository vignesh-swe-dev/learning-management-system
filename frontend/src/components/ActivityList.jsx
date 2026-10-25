/**
 * ActivityList.jsx — Live activity feed with highlight animation
 * for newly arriving rows.
 */
import { useEffect, useRef } from 'react';
import { describe, ICON } from '../utils/activity.js';
import { fmtDateTime } from '../utils/format.js';

export default function ActivityList({ items, empty = 'No activity yet.' }) {
  const prevLen = useRef(items.length);
  const listRef = useRef(null);

  useEffect(() => {
    // Highlight newly prepended rows
    if (items.length > prevLen.current && listRef.current) {
      const newCount = items.length - prevLen.current;
      const lis = listRef.current.querySelectorAll('li');
      for (let i = 0; i < Math.min(newCount, lis.length); i++) {
        lis[i].classList.remove('live-row-new');
        void lis[i].offsetWidth; // force reflow
        lis[i].classList.add('live-row-new');
      }
    }
    prevLen.current = items.length;
  }, [items]);

  if (!items.length) {
    return (
      <div className="empty-state">
        <i className="bi bi-activity" aria-hidden="true" />
        <p>{empty}</p>
      </div>
    );
  }

  return (
    <ul ref={listRef} className="list-group list-group-flush" aria-live="polite">
      {items.map((a) => (
        <li key={a.id} className="list-group-item d-flex gap-2 align-items-start">
          <i className={`bi ${ICON[a.action] || 'bi-dot'} text-accent mt-1`} aria-hidden="true" />
          <div className="flex-grow-1" style={{ fontSize: 13 }}>
            <strong>{a.user?.name}</strong> {describe(a.action, a.meta)}
            {a.course?.title && <span style={{ color: 'var(--lms-text-muted)' }}> · {a.course.title}</span>}
          </div>
          <span className="small text-nowrap" style={{ color: 'var(--lms-text-muted)' }}>{fmtDateTime(a.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
