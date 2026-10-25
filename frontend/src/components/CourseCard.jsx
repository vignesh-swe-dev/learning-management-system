/**
 * CourseCard.jsx — Course card with interactive lift on hover.
 */
import { Link } from 'react-router-dom';
import { assetUrl } from '../services/api.js';

export default function CourseCard({ course, canEnroll, onEnroll, busy }) {
  const instructors = (course.instructors || []).map((i) => i.name).join(', ');
  return (
    <div className="card h-100 overflow-hidden course-card">
      {course.thumbnail
        ? <img src={assetUrl(course.thumbnail)} alt="" className="card-img-top" style={{ height: 148, objectFit: 'cover' }} />
        : (
          <div
            className="d-grid text-white"
            style={{ height: 148, background: 'var(--lms-accent)', placeItems: 'center' }}
          >
            <i className="bi bi-journal-text" style={{ fontSize: 40 }} aria-hidden="true" />
          </div>
        )}
      <div className="card-body d-flex flex-column">
        <div className="d-flex gap-1 flex-wrap mb-2">
          <span className="badge text-bg-light border">{course.category}</span>
          <span className="badge text-bg-light border text-capitalize">{course.level}</span>
          {course.canManage && (
            <span className={`badge ${course.status === 'published' ? 'text-bg-success' : 'text-bg-warning'}`}>
              {course.status}
            </span>
          )}
        </div>
        <h2 className="h6 mb-1">
          <Link to={`/courses/${course._id}`} className="text-decoration-none" style={{ color: 'var(--lms-text)' }}>
            {course.title}
          </Link>
        </h2>
        {instructors && <p className="small mb-2" style={{ color: 'var(--lms-text-muted)' }}>{instructors}</p>}
        <p className="small mb-3" style={{ color: 'var(--lms-text-muted)' }}>
          {course.lessonCount} {course.lessonCount === 1 ? 'lesson' : 'lessons'}
          {course.durationHours ? ` · ${course.durationHours} h` : ''}
          {course.canManage ? ` · ${course.enrollmentCount} enrolled` : ''}
        </p>
        <div className="mt-auto d-flex gap-2">
          <Link to={`/courses/${course._id}`} className="btn btn-outline-primary btn-sm">
            {course.isEnrolled ? 'Continue' : 'View course'}
          </Link>
          {canEnroll && !course.isEnrolled && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onEnroll(course)}>
              {busy
                ? <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />Enrolling…</>
                : 'Enroll'}
            </button>
          )}
          {course.canManage && (
            <Link to={`/courses/${course._id}/edit`} className="btn btn-outline-secondary btn-sm">Edit</Link>
          )}
        </div>
      </div>
    </div>
  );
}
