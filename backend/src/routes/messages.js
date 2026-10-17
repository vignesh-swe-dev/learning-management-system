const router = require('express').Router();
const ctrl = require('../controllers/messageController');
const validate = require('../middleware/validate');
const v = require('../validators/messages');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/contacts', validate(v.contacts, 'query'), ctrl.contacts);
router.get('/conversations', ctrl.conversations);
router.get('/unread-count', ctrl.unreadCount);
router.get('/with/:userId', validate(v.thread, 'query'), ctrl.thread);
router.post('/', validate(v.send), ctrl.send);
module.exports = router;
