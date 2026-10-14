const router = require('express').Router();
const ctrl = require('../controllers/enrollmentController');
const validate = require('../middleware/validate');
const v = require('../validators/enrollments');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.post('/', validate(v.create), ctrl.create);
router.get('/my-courses', ctrl.myCourses);
router.patch('/:id', validate(v.update), ctrl.update);

module.exports = router;
