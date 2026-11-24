const express = require('express');
const router = express.Router();
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All user management routes require Admin privileges
router.use(requireAuth, requireAdmin);

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
