const express = require('express');
const router = express.Router();
const {
  listMachines,
  getMachine,
  createMachine,
  updateMachine,
  deleteMachine,
  updateCustomLabels,
  toggleMachineLogging,
  getSystemSettings,
  updateSystemSettings,
} = require('../controllers/machineController');
const {
  requireAuth,
  requireAdmin,
  requireEditorOrAdmin,
} = require('../middleware/auth');

// Protected routes (require valid JWT)
router.use(requireAuth);

// Machine listing and single view
router.get('/', listMachines);
router.get('/:machineId', getMachine);

// Machine Creation, Update and Deletion (Admin only)
router.post('/', requireAdmin, createMachine);
router.put('/:machineId', requireAdmin, updateMachine);
router.delete('/:machineId', requireAdmin, deleteMachine);

// Edit register labels (Admin or user_editor for assigned machine)
router.put('/:machineId/labels', requireEditorOrAdmin, updateCustomLabels);

// Logging controls (Admin only)
router.put('/:machineId/logging', requireAdmin, toggleMachineLogging);
router.get('/config/settings', requireAdmin, getSystemSettings);
router.put('/config/settings', requireAdmin, updateSystemSettings);

module.exports = router;
