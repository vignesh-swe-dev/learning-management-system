const router = require('express').Router();
const ctrl = require('../controllers/resultController');
const validate = require('../middleware/validate');
const v = require('../validators/results');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, validate(v.list, 'query'), ctrl.list);

module.exports = router;
