export default function Pagination({ page, pages, total, label = 'items', onChange }) {
  return (
    <div className="d-flex align-items-center justify-content-between mt-3">
      <span className="small text-muted">{total} {label}</span>
      {pages > 1 && (
        <div className="btn-group">
          <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
          <span className="btn btn-outline-secondary btn-sm disabled">Page {page} of {pages}</span>
          <button className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
