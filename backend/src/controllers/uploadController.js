const path = require('path');
const { RESOURCE_TYPES } = require('../services/fileValidation');

exports.resource = (req, res) => {
  const ext = path.extname(req.file.filename).slice(1);
  res.status(201).json({
    url: `/api/files/${req.file.filename}`,
    type: RESOURCE_TYPES[ext],
    originalName: req.file.originalname,
    size: req.file.size,
  });
};

exports.thumbnail = (req, res) => {
  res.status(201).json({ url: `/api/thumbnails/${req.file.filename}`, size: req.file.size });
};
