/**
 * Kpi.jsx — Key performance indicator tile.
 * Uses CSS tokens: --lms-kpi-icon-bg, --lms-kpi-icon-color.
 * Adds kpi-card interactive lift effect.
 */
export default function Kpi({ label, value, icon, hint, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`card h-100 kpi-card${onClick ? ' border-0 bg-transparent p-0 w-100 text-start' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="card-body d-flex align-items-center gap-3" style={{ padding: '14px 16px' }}>
        <span className="kpi-icon flex-shrink-0">
          <i className={`bi ${icon}`} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="kpi-value">{value}</div>
          <div className="kpi-label">{label}</div>
          {hint && <div className="kpi-label">{hint}</div>}
        </div>
      </div>
    </Tag>
  );
}
