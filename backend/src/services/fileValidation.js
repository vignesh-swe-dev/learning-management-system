const fs = require('fs/promises');

// Allowed extensions per upload kind, with the lesson type each maps to.
const RESOURCE_TYPES = {
  mp4: 'video', webm: 'video', pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image',
  doc: 'document', docx: 'document', ppt: 'document', pptx: 'document',
};
const THUMBNAIL_EXTS = ['png', 'jpg', 'jpeg', 'webp'];
const SUBMISSION_EXTS = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'zip'];

const MIME = {
  mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', doc: 'application/msword', ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
};

const at = (buf, offset, hex) => buf.subarray(offset, offset + hex.length / 2).toString('hex') === hex;
const SIGNATURES = {
  pdf: (b) => at(b, 0, '25504446'),
  png: (b) => at(b, 0, '89504e47'),
  jpg: (b) => at(b, 0, 'ffd8ff'),
  jpeg: (b) => at(b, 0, 'ffd8ff'),
  gif: (b) => at(b, 0, '47494638'),
  webp: (b) => at(b, 0, '52494646') && at(b, 8, '57454250'),
  mp4: (b) => at(b, 4, '66747970'),
  webm: (b) => at(b, 0, '1a45dfa3'),
  docx: (b) => at(b, 0, '504b0304'),
  pptx: (b) => at(b, 0, '504b0304'),
  doc: (b) => at(b, 0, 'd0cf11e0'),
  ppt: (b) => at(b, 0, 'd0cf11e0'),
  zip: (b) => at(b, 0, '504b0304'),
};

// The file's real content must match its extension, so a renamed script cannot pass as a PDF.
async function matchesSignature(filePath, ext) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    await handle.read(buf, 0, 16, 0);
    return Boolean(SIGNATURES[ext] && SIGNATURES[ext](buf));
  } finally {
    await handle.close();
  }
}

module.exports = { RESOURCE_TYPES, THUMBNAIL_EXTS, SUBMISSION_EXTS, MIME, matchesSignature };
