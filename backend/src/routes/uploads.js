const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { uploadFile } = require('../middleware/upload');
const ctrl = require('../controllers/uploadController');

router.use(authenticate, authorize('admin', 'instructor'));
router.post('/resource', uploadFile('resource'), ctrl.resource);
router.post('/thumbnail', uploadFile('thumbnail'), ctrl.thumbnail);

module.exports = router;
