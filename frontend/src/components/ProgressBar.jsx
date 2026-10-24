/**
 * ProgressBar.jsx — Animated progress bar that fills from 0 on first render.
 * Uses CSS token --lms-accent for the fill colour.
 */
import { useEffect, useRef, useState } from 'react';

export default function ProgressBar({ percent, label }) {
  const [width, setWidth] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    // Delay one frame so the CSS transition from 0 → percent plays
    if (!mounted.current) {
      mounted.current = true;
      requestAnimationFrame(() => setWidth(percent));
    } else {
      setWidth(percent);
    }
  }, [percent]);

  return (
    <div className="d-flex align-items-center gap-2">
      <div
        className="progress flex-grow-1"
        style={{ height: 8 }}
        role="progressbar"
        aria-label={label || 'Progress'}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="progress-bar"
          style={{ width: `${width}%`, background: 'var(--lms-accent)', transition: 'width .6s var(--lms-ease-out)' }}
        />
      </div>
      <span className="small text-nowrap" style={{ color: 'var(--lms-text-muted)', minWidth: 36 }}>
        {percent}%
      </span>
    </div>
  );
}
