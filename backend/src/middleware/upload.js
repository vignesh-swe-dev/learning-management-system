const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const uploads = require('../config/uploads');
const { RESOURCE_TYPES, THUMBNAIL_EXTS, SUBMISSION_EXTS, matchesSignature } = require('../services/fileValidation');

const ALLOWED = { thumbnail: THUMBNAIL_EXTS, resource: Object.keys(RESOURCE_TYPES), submission: SUBMISSION_EXTS };
const LIMITS = { thumbnail: uploads.maxThumbnailBytes, resource: uploads.maxResourceBytes, submission: uploads.maxSubmissionBytes };

const extOf = (name) => path.extname(name).slice(1).toLowerCase();

function buildUploader(kind) {
  const allowed = ALLOWED[kind];
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploads.dirs[kind]),
      // Random names: user-supplied names never touch the file system.
      filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}.${extOf(file.originalname)}`),
    }),
    limits: { fileSize: LIMITS[kind], files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!allowed.includes(extOf(file.originalname))) {
        return cb(new ApiError(400, `Unsupported file type. Allowed: ${allowed.join(', ')}`));
      }
      cb(null, true);
    },
  }).single('file');
}

const uploadFile = (kind, { required = true } = {}) => {
  const run = buildUploader(kind);
  return [
    (req, res, next) => run(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        const mb = Math.round(LIMITS[kind] / 1048576);
        return next(new ApiError(413, `File is too large. The limit is ${mb} MB.`));
      }
      return next(err instanceof ApiError ? err : new ApiError(400, err.message));
    }),
    asyncHandler(async (req, _res, next) => {
      if (!req.file) {
        if (required) throw new ApiError(400, 'Choose a file to upload (form field "file")');
        return next();
      }
      const ext = extOf(req.file.filename);
      if (!(await matchesSignature(req.file.path, ext))) {
        await fs.unlink(req.file.path).catch(() => {});
        throw new ApiError(400, `The file content does not match its .${ext} extension`);
      }
      next();
    }),
  ];
};

module.exports = { uploadFile };
