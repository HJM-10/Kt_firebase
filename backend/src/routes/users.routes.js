const router = require('express').Router();
const { getUsers } = require('../controllers/users.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, requireAdmin, getUsers);
router.put('/:id/role', authenticate, requireAdmin, require('../controllers/users.controller').updateUserRole);
router.delete('/:id', authenticate, requireAdmin, require('../controllers/users.controller').deleteUser);
module.exports = router;
