/**
 * ThemeToggle.jsx
 * Sun/moon button that toggles light ↔ dark on the <html> element.
 * - Reads/writes localStorage['lms-theme'] inside try/catch.
 * - Syncs with the inline theme script in index.html.
 * - aria-label + aria-pressed for accessibility.
 */
import { useEffect, useState } from 'react';

function getStored() {
  try { return localStorage.getItem('lms-theme'); } catch { return null; }
}
function save(t) {
  try { localStorage.setItem('lms-theme', t); } catch { /* noop */ }
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const stored = getStored();
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const theme = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', theme);
    save(theme);
  }, [dark]);

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      onClick={() => setDark((d) => !d)}
    >
      <i
        className={`bi ${dark ? 'bi-sun' : 'bi-moon-stars'}`}
        style={{ fontSize: 16 }}
        aria-hidden="true"
      />
    </button>
  );
}

