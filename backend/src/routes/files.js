const path = require('path');
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const uploads = require('../config/uploads');
const ApiError = require('../utils/ApiError');
const { MIME } = require('../services/fileValidation');

const THUMB_NAME = /^[a-f0-9]{32}\.(png|jpe?g|webp)$/;
const FILE_NAME = /^[a-f0-9]{32}\.[a-z0-9]{2,5}$/;

function send(res, next, dir, name) {
  const ext = path.extname(name).slice(1);
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.type(MIME[ext] || 'application/octet-stream');
  if (['doc', 'docx', 'ppt', 'pptx'].includes(ext)) res.attachment(name);
  res.sendFile(name, { root: dir, dotfiles: 'deny' }, (err) => {
    if (err) next(err.code === 'ENOENT' ? new ApiError(404, 'File not found') : err);
  });
}

// Course thumbnails are public images.
router.get('/thumbnails/:name', (req, res, next) => {
  if (!THUMB_NAME.test(req.params.name)) return next(new ApiError(404, 'File not found'));
  send(res, next, uploads.dirs.thumbnail, req.params.name);
});

// Lesson files need the short-lived signed token issued by GET /api/lessons/:id/access.
router.get('/files/:name', (req, res, next) => {
  const { name } = req.params;
  if (!FILE_NAME.test(name)) return next(new ApiError(404, 'File not found'));
  try {
    const payload = jwt.verify(String(req.query.token || ''), env.jwtSecret);
    if (payload.purpose !== 'file' || payload.file !== name) throw new Error('mismatch');
  } catch {
    return next(new ApiError(403, 'This file link is invalid or has expired. Reopen the lesson to get a new one.'));
  }
  send(res, next, uploads.dirs.resource, name);
});

module.exports = router;
