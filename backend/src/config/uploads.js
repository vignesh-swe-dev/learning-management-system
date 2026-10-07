const path = require('path');
const fs = require('fs');

const root = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
const dirs = {
  resource: path.join(root, 'resources'),
  thumbnail: path.join(root, 'thumbnails'),
  submission: path.join(root, 'submissions'),
};
Object.values(dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }));

const maxResourceMb = Number(process.env.UPLOAD_MAX_MB) || 100;

const maxSubmissionMb = Number(process.env.SUBMISSION_MAX_MB) || 10;

module.exports = {
  root, dirs,
  maxResourceBytes: maxResourceMb * 1024 * 1024,
  maxThumbnailBytes: 2 * 1024 * 1024,
  maxSubmissionBytes: maxSubmissionMb * 1024 * 1024,
};
