const router = require('express').Router();
const ctrl = require('../controllers/notificationController');
const validate = require('../middleware/validate');
const v = require('../validators/notifications');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', validate(v.list, 'query'), ctrl.list);
router.post('/read-all', ctrl.readAll);
router.post('/announcements', authorize('admin', 'instructor'), validate(v.announce), ctrl.announce);
router.patch('/:id/read', ctrl.markRead);

module.exports = router;
