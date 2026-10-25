import { assetUrl } from '../services/api.js';

const isVideoFile = (u) => /\.(mp4|webm)(\?|$)/i.test(u);

export default function LessonViewer({ lesson, onClose, videoProps }) {
  const url = lesson.external ? lesson.url : assetUrl(lesson.url);
  let body;
  if (lesson.type === 'text') {
    body = <div style={{ whiteSpace: 'pre-wrap', maxWidth: '70ch' }}>{lesson.content}</div>;
  } else if (lesson.type === 'video' && isVideoFile(url)) {
    body = <video controls className="w-100 rounded" style={{ maxHeight: 480 }} src={url} {...videoProps} />;
  } else if (lesson.type === 'pdf' && !lesson.external) {
    body = <iframe title={lesson.title} src={url} className="w-100 border rounded" style={{ height: 560 }} />;
  } else if (lesson.type === 'image' && !lesson.external) {
    body = <img src={url} alt={lesson.title} className="img-fluid rounded" />;
  } else {
    body = <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open {lesson.type === 'video' ? 'video' : 'file'}</a>;
  }
  return (
    <div className="card mb-3">
      <div className="card-header d-flex align-items-center">
        <strong className="me-auto">{lesson.title}</strong>
        {onClose && <button className="btn-close" aria-label="Close lesson" onClick={onClose} />}
      </div>
      <div className="card-body">{body}</div>
    </div>
  );
}
